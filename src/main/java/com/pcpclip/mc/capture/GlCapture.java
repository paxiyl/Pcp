package com.pcpclip.mc.capture;

import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.util.PcpLog;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.GlStateManager;
import net.minecraft.client.renderer.OpenGlHelper;
import net.minecraft.client.renderer.Tessellator;
import net.minecraft.client.renderer.WorldRenderer;
import net.minecraft.client.renderer.vertex.DefaultVertexFormats;
import net.minecraft.client.shader.Framebuffer;

import org.lwjgl.BufferUtils;
import org.lwjgl.opengl.GL11;

import java.nio.ByteBuffer;
import java.nio.IntBuffer;

/**
 * Moves the finished frame out of the GPU, cropped and scaled to the output size.
 *
 * <p>Two paths exist, chosen by what the renderer supports.
 *
 * <p><b>Preferred: framebuffer blit.</b> The frame is drawn once into a private framebuffer the
 * size of the output, sampling the game's own framebuffer texture with the crop rectangle as
 * texture coordinates. Three things fall out of that single draw: the GPU does the scaling
 * (filtered, and far cheaper than doing it on the CPU), only the output-sized region has to be
 * read back rather than the whole phone screen, and crop or letterbox comes for free - the quad is
 * simply placed where the geometry says, with the rest of the frame left black. Nothing is scaled
 * non-uniformly, so the HUD never distorts.
 *
 * <p><b>Fallback: direct read.</b> If framebuffer objects are unavailable, or the game is not
 * rendering through one, the whole framebuffer is read and the crop and scale happen on an encoder
 * worker instead. Correct everywhere, just more bytes over the bus.
 *
 * <p>Either way the pixels land in a pooled direct buffer, and the readback can be asynchronous
 * where the driver really supports it.
 *
 * <p>All methods must be called on the render thread.
 */
public final class GlCapture {

    /** {@code GL_FRAMEBUFFER_BINDING}; the same value in the EXT, ARB and core spellings. */
    private static final int GL_FRAMEBUFFER_BINDING = 0x8CA6;

    private final CaptureCapabilities capabilities;
    private final boolean asyncRequested;

    private int ownFramebuffer;
    private int ownTexture;
    private int ownWidth;
    private int ownHeight;
    private boolean blitPathBroken;

    private PboReadback readback;
    private boolean readbackAttempted;

    private final IntBuffer viewportStore = BufferUtils.createIntBuffer(16);
    private long lastCostNanos;
    private String pathDescription = "not started";

    public GlCapture(CaptureCapabilities capabilities, boolean asyncRequested) {
        this.capabilities = capabilities;
        this.asyncRequested = asyncRequested;
    }

    public CaptureCapabilities capabilities() {
        return capabilities;
    }

    /** True when frames arrive already cropped and scaled, so no CPU rescale is needed. */
    public boolean canUseBlitPath() {
        return !blitPathBroken
                && capabilities.framebufferSupported
                && capabilities.gameFramebufferEnabled
                && sourceFramebuffer() != null;
    }

    public String describePath() {
        return pathDescription;
    }

    public long lastCostNanos() {
        return lastCostNanos;
    }

    private Framebuffer sourceFramebuffer() {
        try {
            Framebuffer framebuffer = Minecraft.getMinecraft().getFramebuffer();
            return framebuffer != null && framebuffer.framebufferTexture > 0 ? framebuffer : null;
        } catch (Throwable error) {
            return null;
        }
    }

    /**
     * Captures into {@code frame}.
     *
     * @return true when the frame holds pixels and should be encoded; false when it should be
     *         released untouched, which happens on the first asynchronous frame and on failure
     */
    public boolean capture(VideoFrame frame, OutputGeometry geometry) {
        long started = System.nanoTime();
        try {
            if (canUseBlitPath()) {
                return captureViaBlit(frame, geometry);
            }
            return captureDirect(frame, geometry);
        } catch (Throwable error) {
            PcpLog.warn("Frame capture failed; disabling the accelerated path", error);
            blitPathBroken = true;
            return false;
        } finally {
            lastCostNanos = System.nanoTime() - started;
        }
    }

    private boolean captureViaBlit(VideoFrame frame, OutputGeometry geometry) {
        Framebuffer source = sourceFramebuffer();
        if (source == null) {
            blitPathBroken = true;
            return false;
        }
        if (!ensureOwnFramebuffer(geometry.outWidth, geometry.outHeight)) {
            blitPathBroken = true;
            pathDescription = "direct read (private framebuffer unavailable)";
            return captureDirect(frame, geometry);
        }

        int previousFramebuffer = GL11.glGetInteger(GL_FRAMEBUFFER_BINDING);
        viewportStore.clear();
        GL11.glGetInteger(GL11.GL_VIEWPORT, viewportStore);
        int previousViewportX = viewportStore.get(0);
        int previousViewportY = viewportStore.get(1);
        int previousViewportWidth = viewportStore.get(2);
        int previousViewportHeight = viewportStore.get(3);

        try {
            OpenGlHelper.glBindFramebuffer(OpenGlHelper.GL_FRAMEBUFFER, ownFramebuffer);
            GlStateManager.viewport(0, 0, ownWidth, ownHeight);

            GlStateManager.matrixMode(GL11.GL_PROJECTION);
            GlStateManager.pushMatrix();
            GlStateManager.loadIdentity();
            // Bottom-left origin, matching both GL and OutputGeometry's convention.
            GlStateManager.ortho(0.0D, ownWidth, 0.0D, ownHeight, -1.0D, 1.0D);
            GlStateManager.matrixMode(GL11.GL_MODELVIEW);
            GlStateManager.pushMatrix();
            GlStateManager.loadIdentity();

            GlStateManager.disableDepth();
            GlStateManager.depthMask(false);
            GlStateManager.disableBlend();
            GlStateManager.disableLighting();
            GlStateManager.disableAlpha();
            GlStateManager.disableCull();
            GlStateManager.enableTexture2D();
            GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);

            if (geometry.needsBackgroundFill()) {
                GlStateManager.clearColor(0.0F, 0.0F, 0.0F, 1.0F);
                GlStateManager.clear(GL11.GL_COLOR_BUFFER_BIT);
            }

            drawSourceQuad(source, geometry);

            boolean filled = readPixels(frame, ownWidth, ownHeight);
            pathDescription = (readback != null && readback.usable()
                    ? "framebuffer blit, asynchronous readback"
                    : "framebuffer blit, synchronous readback")
                    + " (" + ownWidth + "x" + ownHeight + ")";
            return filled;
        } finally {
            GlStateManager.matrixMode(GL11.GL_MODELVIEW);
            GlStateManager.popMatrix();
            GlStateManager.matrixMode(GL11.GL_PROJECTION);
            GlStateManager.popMatrix();
            GlStateManager.matrixMode(GL11.GL_MODELVIEW);

            // Hand the renderer back the state the game's own HUD pass leaves behind, so the
            // frame that follows is unaffected.
            GlStateManager.enableDepth();
            GlStateManager.depthMask(true);
            GlStateManager.enableAlpha();
            GlStateManager.enableBlend();
            GlStateManager.enableCull();
            GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);

            OpenGlHelper.glBindFramebuffer(OpenGlHelper.GL_FRAMEBUFFER, previousFramebuffer);
            GlStateManager.viewport(previousViewportX, previousViewportY,
                    previousViewportWidth, previousViewportHeight);
        }
    }

    /** One textured quad: the crop rectangle of the game's frame, placed per the geometry. */
    private void drawSourceQuad(Framebuffer source, OutputGeometry geometry) {
        int textureWidth = Math.max(1, source.framebufferTextureWidth);
        int textureHeight = Math.max(1, source.framebufferTextureHeight);

        double u0 = geometry.srcX / (double) textureWidth;
        double u1 = (geometry.srcX + geometry.srcWidth) / (double) textureWidth;
        double v0 = geometry.srcY / (double) textureHeight;
        double v1 = (geometry.srcY + geometry.srcHeight) / (double) textureHeight;

        double x0 = geometry.dstX;
        double x1 = geometry.dstX + geometry.dstWidth;
        double y0 = geometry.dstY;
        double y1 = geometry.dstY + geometry.dstHeight;

        GlStateManager.bindTexture(source.framebufferTexture);
        // Linear sampling for the downscale; the game leaves its framebuffer on nearest, which
        // would alias badly when a 2400-pixel-wide phone frame becomes a 1280-pixel clip.
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_LINEAR);
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_LINEAR);
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_S, GL11.GL_CLAMP);
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_T, GL11.GL_CLAMP);

        Tessellator tessellator = Tessellator.getInstance();
        WorldRenderer renderer = tessellator.getWorldRenderer();
        renderer.begin(GL11.GL_QUADS, DefaultVertexFormats.POSITION_TEX);
        renderer.pos(x0, y0, 0.0D).tex(u0, v0).endVertex();
        renderer.pos(x1, y0, 0.0D).tex(u1, v0).endVertex();
        renderer.pos(x1, y1, 0.0D).tex(u1, v1).endVertex();
        renderer.pos(x0, y1, 0.0D).tex(u0, v1).endVertex();
        tessellator.draw();

        // Put the game's own filter back; OptiFine and vanilla both rely on it.
        int filter = source.framebufferFilter > 0 ? source.framebufferFilter : GL11.GL_NEAREST;
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, filter);
        GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, filter);
    }

    /** Reads the whole framebuffer; the crop and scale then happen on an encoder worker. */
    private boolean captureDirect(VideoFrame frame, OutputGeometry geometry) {
        pathDescription = "direct framebuffer read (" + geometry.srcWidth + "x" + geometry.srcHeight
                + (readback != null && readback.usable() ? ", asynchronous)" : ", synchronous)");
        return readPixels(frame, geometry.srcWidth, geometry.srcHeight);
    }

    /**
     * Reads {@code width x height} RGBA pixels into the frame.
     *
     * <p>RGBA with unsigned bytes is the one format OpenGL ES guarantees for readback, which is
     * why no attempt is made at BGRA even though it would save a swizzle on the CPU.
     */
    private boolean readPixels(VideoFrame frame, int width, int height) {
        ByteBuffer destination = frame.pixels();
        int needed = width * height * 4;
        if (destination.capacity() < needed) {
            return false;
        }

        if (asyncRequested && !blitPathBroken) {
            PboReadback async = ensureReadback(needed);
            if (async != null && async.usable()) {
                boolean collected = false;
                if (async.hasPending() && async.pendingWidth() == width
                        && async.pendingHeight() == height) {
                    long pts = async.pendingPtsNanos();
                    collected = async.collect(destination);
                    if (collected) {
                        // The pixels belong to the frame that asked for them, not to this one.
                        frame.setPtsNanos(pts);
                    }
                }
                async.request(width, height, frame.ptsNanos());
                if (collected) {
                    return true;
                }
                if (async.usable()) {
                    // Nothing to collect yet: this is the pipeline filling, not a failure.
                    return false;
                }
            }
        }

        destination.clear();
        destination.limit(needed);
        GL11.glReadPixels(0, 0, width, height, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, destination);
        destination.position(0);
        destination.limit(needed);
        return true;
    }

    private PboReadback ensureReadback(int bytes) {
        if (readback != null) {
            if (!readback.usable()) {
                return null;
            }
            return readback;
        }
        if (readbackAttempted || !capabilities.pixelBufferObjects) {
            return null;
        }
        readbackAttempted = true;
        readback = PboReadback.createIfWorkable(bytes);
        return readback;
    }

    /** Creates or resizes the private framebuffer used for the blit path. */
    private boolean ensureOwnFramebuffer(int width, int height) {
        if (width > capabilities.maxTextureSize || height > capabilities.maxTextureSize) {
            PcpLog.warn("Output " + width + "x" + height + " exceeds the maximum texture size "
                    + capabilities.maxTextureSize + "; falling back to a direct read");
            return false;
        }
        if (ownFramebuffer > 0 && ownWidth == width && ownHeight == height) {
            return true;
        }
        disposeOwnFramebuffer();

        try {
            ownTexture = GL11.glGenTextures();
            GlStateManager.bindTexture(ownTexture);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MIN_FILTER, GL11.GL_NEAREST);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_MAG_FILTER, GL11.GL_NEAREST);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_S, GL11.GL_CLAMP);
            GL11.glTexParameteri(GL11.GL_TEXTURE_2D, GL11.GL_TEXTURE_WRAP_T, GL11.GL_CLAMP);
            GL11.glTexImage2D(GL11.GL_TEXTURE_2D, 0, GL11.GL_RGBA, width, height, 0,
                    GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, (ByteBuffer) null);

            ownFramebuffer = OpenGlHelper.glGenFramebuffers();
            int previous = GL11.glGetInteger(GL_FRAMEBUFFER_BINDING);
            OpenGlHelper.glBindFramebuffer(OpenGlHelper.GL_FRAMEBUFFER, ownFramebuffer);
            OpenGlHelper.glFramebufferTexture2D(OpenGlHelper.GL_FRAMEBUFFER,
                    OpenGlHelper.GL_COLOR_ATTACHMENT0, GL11.GL_TEXTURE_2D, ownTexture, 0);
            int status = OpenGlHelper.glCheckFramebufferStatus(OpenGlHelper.GL_FRAMEBUFFER);
            OpenGlHelper.glBindFramebuffer(OpenGlHelper.GL_FRAMEBUFFER, previous);

            if (status != OpenGlHelper.GL_FRAMEBUFFER_COMPLETE) {
                PcpLog.warn("Capture framebuffer incomplete (status " + status
                        + "); falling back to a direct read");
                disposeOwnFramebuffer();
                return false;
            }
            ownWidth = width;
            ownHeight = height;
            PcpLog.info("capture framebuffer ready at " + width + "x" + height);
            return true;
        } catch (Throwable error) {
            PcpLog.warn("Could not create the capture framebuffer", error);
            disposeOwnFramebuffer();
            return false;
        }
    }

    private void disposeOwnFramebuffer() {
        try {
            if (ownFramebuffer > 0) {
                OpenGlHelper.glDeleteFramebuffers(ownFramebuffer);
            }
            if (ownTexture > 0) {
                GL11.glDeleteTextures(ownTexture);
            }
        } catch (Throwable ignored) {
            // the context may already be gone during shutdown
        }
        ownFramebuffer = 0;
        ownTexture = 0;
        ownWidth = 0;
        ownHeight = 0;
    }

    /** Releases GL resources. Must run on the render thread. */
    public void dispose() {
        disposeOwnFramebuffer();
        if (readback != null) {
            readback.dispose();
            readback = null;
        }
        readbackAttempted = false;
    }
}
