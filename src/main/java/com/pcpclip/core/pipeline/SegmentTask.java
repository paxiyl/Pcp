package com.pcpclip.core.pipeline;

import com.pcpclip.core.codec.VideoEncoder;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentWriter;
import com.pcpclip.core.util.PcpLog;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Encodes one segment on a worker thread.
 *
 * <p>Giving each segment its own task is what lets several CPU cores help when the encoder falls
 * behind: segment N+1 can start on another thread while segment N is still draining, because
 * segments share no encoder state - each one begins with its own keyframe.
 *
 * <p>The task owns its encoder and its writer, so neither needs locking.
 */
final class SegmentTask implements Runnable {

    private static final long POLL_MILLIS = 100L;

    private final BlockingQueue<VideoFrame> queue;
    private final VideoEncoder encoder;
    private final SegmentWriter writer;
    private final PipelineStats stats;
    private final Listener listener;

    private volatile boolean sealed;
    private volatile boolean aborted;

    interface Listener {
        void segmentFinished(SegmentHandle handle);

        void segmentFailed(String message, Throwable error);
    }

    SegmentTask(VideoEncoder encoder, SegmentWriter writer, int queueCapacity,
                PipelineStats stats, Listener listener) {
        this.encoder = encoder;
        this.writer = writer;
        this.stats = stats;
        this.listener = listener;
        this.queue = new ArrayBlockingQueue<VideoFrame>(Math.max(2, queueCapacity));
    }

    SegmentHandle handle() {
        return writer.handle();
    }

    /**
     * Hands a frame to this segment, waiting if the segment's own queue is full.
     *
     * <p>Called from the dispatcher thread, never from the render thread, so blocking here only
     * slows the dispatcher - and that backpressure is what makes the render thread drop frames
     * instead of the pipeline growing without bound.
     */
    boolean submit(VideoFrame frame, long timeoutMillis) throws InterruptedException {
        if (sealed || aborted) {
            return false;
        }
        return queue.offer(frame, timeoutMillis, TimeUnit.MILLISECONDS);
    }

    /** Marks the segment complete; the worker finishes the queue and then closes the file. */
    void seal() {
        sealed = true;
    }

    void abort() {
        aborted = true;
        sealed = true;
    }

    int backlog() {
        return queue.size();
    }

    @Override
    public void run() {
        try {
            while (true) {
                VideoFrame frame = queue.poll(POLL_MILLIS, TimeUnit.MILLISECONDS);
                if (frame == null) {
                    if (sealed && queue.isEmpty()) {
                        break;
                    }
                    continue;
                }
                try {
                    if (!aborted) {
                        long started = System.nanoTime();
                        long before = writer.handle().bytes();
                        encoder.encode(frame, writer);
                        long written = writer.handle().bytes() - before;
                        stats.encoded((int) written, System.nanoTime() - started);
                    }
                } finally {
                    frame.release();
                }
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            aborted = true;
        } catch (Throwable error) {
            aborted = true;
            stats.encoderError(error.toString());
            PcpLog.error("Encoding failed for " + writer.handle().file.getName(), error);
            listener.segmentFailed("Encoder error: " + error, error);
        } finally {
            drainAndRelease();
            encoder.close();
            if (aborted) {
                writer.abort();
            } else {
                SegmentHandle finished = writer.finish(true);
                if (finished.frameCount() > 0) {
                    stats.segmentWritten();
                    listener.segmentFinished(finished);
                } else {
                    writer.abort();
                }
            }
        }
    }

    /** Frames still queued when a segment is abandoned must go back to the pool. */
    private void drainAndRelease() {
        VideoFrame pending;
        while ((pending = queue.poll()) != null) {
            pending.release();
        }
    }
}
