package com.pcpclip.mc.capture;

import com.pcpclip.core.util.PcpLog;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.OpenGlHelper;

import org.lwjgl.opengl.ContextCapabilities;
import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GLContext;

import java.util.ArrayList;
import java.util.List;

/**
 * What the renderer underneath us can actually do, probed once on the render thread.
 *
 * <p>This matters more here than on a desktop: PojavLauncher usually runs GL4ES, which presents
 * a desktop-looking GL on top of OpenGL ES. Several things a desktop mod would take for granted -
 * pixel buffer objects, {@code glGetTexImage}, {@code GL_BGRA} readback - are either missing or
 * emulated badly. Everything here is therefore detected rather than assumed, and each detection
 * has a fallback.
 */
public final class CaptureCapabilities {

    public final String glVersion;
    public final String renderer;
    public final String vendor;
    public final boolean framebufferSupported;
    public final boolean gameFramebufferEnabled;
    public final boolean pixelBufferObjects;
    public final int maxTextureSize;
    public final boolean likelyGl4es;
    private final List<String> notes;

    private CaptureCapabilities(String glVersion, String renderer, String vendor,
                                boolean framebufferSupported, boolean gameFramebufferEnabled,
                                boolean pixelBufferObjects, int maxTextureSize,
                                boolean likelyGl4es, List<String> notes) {
        this.glVersion = glVersion;
        this.renderer = renderer;
        this.vendor = vendor;
        this.framebufferSupported = framebufferSupported;
        this.gameFramebufferEnabled = gameFramebufferEnabled;
        this.pixelBufferObjects = pixelBufferObjects;
        this.maxTextureSize = maxTextureSize;
        this.likelyGl4es = likelyGl4es;
        this.notes = notes;
    }

    /** Must be called on the render thread, where a GL context exists. */
    public static CaptureCapabilities probe() {
        List<String> notes = new ArrayList<String>();
        String version = safeString(GL11.GL_VERSION);
        String renderer = safeString(GL11.GL_RENDERER);
        String vendor = safeString(GL11.GL_VENDOR);

        boolean fbo = OpenGlHelper.framebufferSupported;
        boolean gameFbo = false;
        try {
            gameFbo = OpenGlHelper.isFramebufferEnabled()
                    && Minecraft.getMinecraft().getFramebuffer() != null;
        } catch (Throwable error) {
            notes.add("could not query the game's framebuffer: " + error);
        }

        int maxTexture = 2048;
        try {
            maxTexture = GL11.glGetInteger(GL11.GL_MAX_TEXTURE_SIZE);
        } catch (Throwable error) {
            notes.add("GL_MAX_TEXTURE_SIZE unavailable; assuming 2048");
        }
        if (maxTexture <= 0) {
            maxTexture = 2048;
        }

        boolean pbo = false;
        try {
            ContextCapabilities capabilities = GLContext.getCapabilities();
            pbo = capabilities != null
                    && (capabilities.GL_ARB_pixel_buffer_object || capabilities.OpenGL21);
        } catch (Throwable error) {
            notes.add("could not read GL capabilities: " + error);
        }

        String haystack = (renderer + " " + version + " " + vendor).toLowerCase();
        boolean gl4es = haystack.contains("gl4es") || haystack.contains("opengl es")
                || haystack.contains("mali") || haystack.contains("adreno")
                || haystack.contains("powervr");
        if (gl4es) {
            notes.add("GL4ES or an OpenGL ES driver detected: using the conservative capture path");
        }

        notes.add("GL " + version + " | " + renderer + " | " + vendor);
        notes.add("framebuffer objects: " + (fbo ? "yes" : "no")
                + ", game framebuffer in use: " + (gameFbo ? "yes" : "no")
                + ", max texture " + maxTexture);
        notes.add("pixel buffer objects advertised: " + (pbo ? "yes" : "no"));

        CaptureCapabilities result = new CaptureCapabilities(version, renderer, vendor, fbo, gameFbo,
                pbo, maxTexture, gl4es, notes);
        for (String note : notes) {
            PcpLog.info("renderer probe | " + note);
        }
        return result;
    }

    private static String safeString(int name) {
        try {
            String value = GL11.glGetString(name);
            return value == null ? "unknown" : value;
        } catch (Throwable error) {
            return "unknown";
        }
    }

    public List<String> notes() {
        return new ArrayList<String>(notes);
    }

    /** One line for the status screen. */
    public String summary() {
        return renderer + " (GL " + glVersion + ")";
    }
}
