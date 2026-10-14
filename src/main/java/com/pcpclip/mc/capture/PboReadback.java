package com.pcpclip.mc.capture;

import com.pcpclip.core.util.PcpLog;

import org.lwjgl.opengl.GL11;
import org.lwjgl.opengl.GL15;
import org.lwjgl.opengl.GL21;

import java.nio.ByteBuffer;

/**
 * Asynchronous pixel readback through a pixel buffer object.
 *
 * <p>A plain {@code glReadPixels} makes the render thread wait for the GPU to finish and hand the
 * pixels back, which is the single most expensive thing a capture can do to frame pacing. Reading
 * into a pixel buffer object instead lets the driver answer later: this class asks for frame N's
 * pixels, and collects them on frame N+1, so the render thread never blocks on the GPU.
 *
 * <p>Pixel buffer objects are core desktop GL but only appear in OpenGL ES 3, and GL4ES does not
 * always provide a working implementation even when it advertises one. So the class self-tests at
 * creation with a tiny real readback, and any GL error at any later point disables it permanently
 * in favour of the synchronous path. A capture that works is worth more than a capture that is
 * fast.
 */
final class PboReadback {

    private final int buffer;
    private final int capacityBytes;

    private boolean pending;
    private int pendingWidth;
    private int pendingHeight;
    private long pendingPtsNanos;
    private boolean broken;
    /** Collects that returned no data. A driver that keeps doing this is not worth paying for. */
    private int softFailures;

    private PboReadback(int buffer, int capacityBytes) {
        this.buffer = buffer;
        this.capacityBytes = capacityBytes;
    }

    /**
     * Creates and self-tests a readback buffer.
     *
     * @return null when pixel buffer objects are unusable here, which is not an error
     */
    static PboReadback createIfWorkable(int capacityBytes) {
        int id;
        try {
            clearGlErrors();
            id = GL15.glGenBuffers();
            if (id <= 0) {
                return null;
            }
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, id);
            GL15.glBufferData(GL21.GL_PIXEL_PACK_BUFFER, capacityBytes, GL15.GL_STREAM_READ);
            if (GL11.glGetError() != GL11.GL_NO_ERROR) {
                GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
                GL15.glDeleteBuffers(id);
                return null;
            }

            // Real one-pixel readback: this is what catches drivers that advertise the extension
            // but fail the moment a buffer object is the readback target.
            GL11.glReadPixels(0, 0, 1, 1, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, 0L);
            if (GL11.glGetError() != GL11.GL_NO_ERROR) {
                GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
                GL15.glDeleteBuffers(id);
                PcpLog.info("pixel buffer readback refused by the driver; using synchronous reads");
                return null;
            }
            ByteBuffer mapped = GL15.glMapBuffer(GL21.GL_PIXEL_PACK_BUFFER, GL15.GL_READ_ONLY,
                    capacityBytes, null);
            boolean mappable = mapped != null && GL11.glGetError() == GL11.GL_NO_ERROR;
            if (mappable) {
                GL15.glUnmapBuffer(GL21.GL_PIXEL_PACK_BUFFER);
            }
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
            if (!mappable) {
                GL15.glDeleteBuffers(id);
                PcpLog.info("pixel buffer mapping unavailable; using synchronous reads");
                return null;
            }
            PcpLog.info("asynchronous pixel readback enabled (" + capacityBytes / 1024 + " KB buffer)");
            return new PboReadback(id, capacityBytes);
        } catch (Throwable error) {
            PcpLog.info("pixel buffer objects unusable here (" + error + "); using synchronous reads");
            return null;
        }
    }

    boolean usable() {
        return !broken;
    }

    /** True when a previous frame's pixels are waiting to be collected. */
    boolean hasPending() {
        return pending;
    }

    /** Throws away a pending read, used when the capture size changed under it. */
    void discardPending() {
        pending = false;
    }

    long pendingPtsNanos() {
        return pendingPtsNanos;
    }

    /** Asks the driver for the current framebuffer's pixels, without waiting for them. */
    boolean request(int width, int height, long ptsNanos) {
        if (broken || width * height * 4 > capacityBytes) {
            return false;
        }
        try {
            clearGlErrors();
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, buffer);
            GL11.glReadPixels(0, 0, width, height, GL11.GL_RGBA, GL11.GL_UNSIGNED_BYTE, 0L);
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
            if (GL11.glGetError() != GL11.GL_NO_ERROR) {
                fail("readback request failed");
                return false;
            }
            pending = true;
            pendingWidth = width;
            pendingHeight = height;
            pendingPtsNanos = ptsNanos;
            return true;
        } catch (Throwable error) {
            fail("readback request threw " + error);
            return false;
        }
    }

    /**
     * Copies the pixels requested last frame into {@code destination}.
     *
     * @return false when nothing was pending or the driver failed, in which case the caller falls
     *         back to a synchronous read
     */
    boolean collect(ByteBuffer destination) {
        if (broken || !pending) {
            return false;
        }
        pending = false;
        int bytes = pendingWidth * pendingHeight * 4;
        try {
            clearGlErrors();
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, buffer);
            ByteBuffer mapped = GL15.glMapBuffer(GL21.GL_PIXEL_PACK_BUFFER, GL15.GL_READ_ONLY,
                    bytes, null);
            if (mapped == null || GL11.glGetError() != GL11.GL_NO_ERROR) {
                GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
                fail("could not map the readback buffer");
                return false;
            }
            destination.clear();
            int limit = Math.min(bytes, Math.min(mapped.remaining(), destination.remaining()));
            ByteBuffer slice = mapped.duplicate();
            slice.limit(slice.position() + limit);
            destination.put(slice);
            destination.flip();
            GL15.glUnmapBuffer(GL21.GL_PIXEL_PACK_BUFFER);
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
            if (limit == bytes) {
                softFailures = 0;
                return true;
            }
            // The driver mapped a buffer but gave back less than a frame. The caller falls back to
            // a synchronous read, so no frame is lost; give up on asynchronous reads if it keeps
            // happening rather than paying for a request that never pays off.
            if (++softFailures >= 2) {
                fail("the driver returned " + limit + " of " + bytes + " bytes twice");
            }
            return false;
        } catch (Throwable error) {
            fail("collecting pixels threw " + error);
            return false;
        }
    }

    int pendingWidth() {
        return pendingWidth;
    }

    int pendingHeight() {
        return pendingHeight;
    }

    private void fail(String reason) {
        if (!broken) {
            broken = true;
            pending = false;
            PcpLog.warn("asynchronous readback disabled: " + reason
                    + "; falling back to synchronous reads");
        }
    }

    void dispose() {
        try {
            GL15.glBindBuffer(GL21.GL_PIXEL_PACK_BUFFER, 0);
            GL15.glDeleteBuffers(buffer);
        } catch (Throwable ignored) {
            // the context may already be gone during shutdown
        }
        pending = false;
    }

    /** GL errors are sticky, so a leftover error from elsewhere must not be blamed on us. */
    private static void clearGlErrors() {
        for (int i = 0; i < 8 && GL11.glGetError() != GL11.GL_NO_ERROR; i++) {
            // drain
        }
    }
}
