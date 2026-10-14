package com.pcpclip.core.frame;

import com.pcpclip.core.geom.OutputGeometry;

import java.nio.ByteBuffer;

/**
 * One captured frame on its way to an encoder.
 *
 * <p>Frames are pooled. The pixel buffer is a direct {@link ByteBuffer} so the GL readback can
 * write straight into it with no intermediate copy, and it is handed back to the pool by
 * {@link #release()} as soon as an encoder is done with it. Nothing else may touch the buffer
 * after release.
 *
 * <p>Pixels are RGBA, 8 bits per channel, with the GL origin at the bottom-left; the colour
 * conversion step flips rows while it reads.
 */
public final class VideoFrame {

    private final FramePool pool;
    private final ByteBuffer pixels;
    private final int capacity;

    /** Width and height of the data actually in the buffer. */
    private int width;
    private int height;
    /** Transform from this buffer to the encoded frame (identity-ish when the GPU already scaled). */
    private OutputGeometry geometry;
    private long ptsNanos;
    private long sequence;

    VideoFrame(FramePool pool, int capacityBytes) {
        this.pool = pool;
        this.capacity = capacityBytes;
        this.pixels = ByteBuffer.allocateDirect(capacityBytes);
    }

    void prepare(int width, int height, OutputGeometry geometry, long ptsNanos, long sequence) {
        this.width = width;
        this.height = height;
        this.geometry = geometry;
        this.ptsNanos = ptsNanos;
        this.sequence = sequence;
        pixels.clear();
        pixels.limit(Math.min(capacity, width * height * 4));
    }

    public ByteBuffer pixels() {
        return pixels;
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public OutputGeometry geometry() {
        return geometry;
    }

    public long ptsNanos() {
        return ptsNanos;
    }

    public void setPtsNanos(long ptsNanos) {
        this.ptsNanos = ptsNanos;
    }

    public long sequence() {
        return sequence;
    }

    public int capacityBytes() {
        return capacity;
    }

    /** Returns the frame to its pool. Safe to call once per acquisition. */
    public void release() {
        pool.release(this);
    }
}
