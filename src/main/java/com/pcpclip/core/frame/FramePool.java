package com.pcpclip.core.frame;

import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.util.PcpLog;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Bounded pool of direct pixel buffers.
 *
 * <p>The pool is the memory bound for the whole capture pipeline: a frame cannot enter the
 * pipeline without a buffer, so a slow encoder can never grow the backlog past
 * {@code capacity} frames. When the pool is empty the render thread drops the frame instead of
 * waiting - dropping a capture is always better than stalling the game.
 *
 * <p>Buffers are allocated lazily, so switching to a smaller preset does not pay for the old one.
 * Direct buffers are never explicitly freed; they are reused for the life of the pool.
 */
public final class FramePool {

    private final BlockingQueue<VideoFrame> idle;
    private final int capacity;
    private final int frameBytes;
    private final AtomicInteger created = new AtomicInteger();
    private final AtomicInteger inFlight = new AtomicInteger();
    private volatile boolean closed;

    /**
     * @param frameBytes   bytes needed for one frame (width * height * 4)
     * @param budgetBytes  upper bound on total pooled memory
     */
    public FramePool(int frameBytes, long budgetBytes) {
        this.frameBytes = Math.max(4, frameBytes);
        int fits = (int) Math.max(1L, budgetBytes / this.frameBytes);
        // Two buffers is the minimum for any overlap of capture and encode; more than eight only
        // adds latency, because by then the encoder is hopelessly behind.
        this.capacity = Math.max(2, Math.min(8, fits));
        this.idle = new ArrayBlockingQueue<VideoFrame>(this.capacity);
    }

    public int capacity() {
        return capacity;
    }

    public int frameBytes() {
        return frameBytes;
    }

    public long budgetBytes() {
        return (long) capacity * frameBytes;
    }

    public int inFlight() {
        return inFlight.get();
    }

    public int allocated() {
        return created.get();
    }

    /**
     * Takes a buffer, or returns null when every buffer is still with an encoder.
     *
     * <p>Called from the render thread; never blocks and never allocates once warm.
     */
    public VideoFrame acquire(int width, int height, OutputGeometry geometry, long ptsNanos, long sequence) {
        if (closed) {
            return null;
        }
        VideoFrame frame = idle.poll();
        if (frame == null) {
            if (created.get() >= capacity) {
                return null;
            }
            // Allocation only happens while the pool warms up (at most `capacity` times).
            try {
                frame = new VideoFrame(this, frameBytes);
            } catch (OutOfMemoryError error) {
                PcpLog.warn("Out of direct memory while growing the frame pool; capping at "
                        + created.get() + " buffers");
                return null;
            }
            created.incrementAndGet();
        }
        if (width * height * 4 > frame.capacityBytes()) {
            // The output size changed under us; this buffer belongs to the previous geometry.
            idle.offer(frame);
            return null;
        }
        frame.prepare(width, height, geometry, ptsNanos, sequence);
        inFlight.incrementAndGet();
        return frame;
    }

    void release(VideoFrame frame) {
        if (frame == null) {
            return;
        }
        inFlight.decrementAndGet();
        if (!closed) {
            idle.offer(frame);
        }
    }

    /** Stops handing out buffers and drops the idle ones so the GC can reclaim them. */
    public void close() {
        closed = true;
        idle.clear();
    }
}
