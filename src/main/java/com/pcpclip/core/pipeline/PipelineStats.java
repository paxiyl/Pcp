package com.pcpclip.core.pipeline;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Counters for everything the user might want to know and everything the performance saver needs
 * to make decisions.
 *
 * <p>All updates are single atomic operations, because some of them happen on the render thread
 * once per frame. Nothing here locks, allocates or formats.
 */
public final class PipelineStats {

    private final AtomicLong captureAttempts = new AtomicLong();
    private final AtomicLong capturedFrames = new AtomicLong();
    private final AtomicLong droppedNoBuffer = new AtomicLong();
    private final AtomicLong droppedQueueFull = new AtomicLong();
    private final AtomicLong encodedFrames = new AtomicLong();
    private final AtomicLong encodedBytes = new AtomicLong();
    private final AtomicLong segmentsWritten = new AtomicLong();
    private final AtomicInteger encoderErrors = new AtomicInteger();
    private final AtomicLong timestampAnomalies = new AtomicLong();

    private final AtomicLong readbackNanos = new AtomicLong();
    private final AtomicLong readbackSamples = new AtomicLong();
    private final AtomicLong encodeNanos = new AtomicLong();

    private volatile String lastError = "";
    private volatile long firstCaptureNanos = -1L;
    private volatile long lastCaptureNanos = -1L;

    public void captureAttempt() {
        captureAttempts.incrementAndGet();
    }

    public void captured(long ptsNanos, long readbackCostNanos) {
        capturedFrames.incrementAndGet();
        readbackNanos.addAndGet(readbackCostNanos);
        readbackSamples.incrementAndGet();
        if (firstCaptureNanos < 0L) {
            firstCaptureNanos = ptsNanos;
        }
        lastCaptureNanos = ptsNanos;
    }

    public void dropNoBuffer() {
        droppedNoBuffer.incrementAndGet();
    }

    public void dropQueueFull() {
        droppedQueueFull.incrementAndGet();
    }

    public void encoded(int bytes, long costNanos) {
        encodedFrames.incrementAndGet();
        encodedBytes.addAndGet(bytes);
        encodeNanos.addAndGet(costNanos);
    }

    public void segmentWritten() {
        segmentsWritten.incrementAndGet();
    }

    /** A capture arrived with a timestamp that did not move forward; see CapturePipeline.offer. */
    public void timestampAnomaly() {
        timestampAnomalies.incrementAndGet();
    }

    public long timestampAnomalyCount() {
        return timestampAnomalies.get();
    }

    public void encoderError(String message) {
        encoderErrors.incrementAndGet();
        lastError = message == null ? "" : message;
    }

    public long captureAttemptCount() {
        return captureAttempts.get();
    }

    public long capturedFrameCount() {
        return capturedFrames.get();
    }

    public long droppedFrameCount() {
        return droppedNoBuffer.get() + droppedQueueFull.get();
    }

    public long droppedNoBufferCount() {
        return droppedNoBuffer.get();
    }

    public long droppedQueueFullCount() {
        return droppedQueueFull.get();
    }

    public long encodedFrameCount() {
        return encodedFrames.get();
    }

    public long encodedByteCount() {
        return encodedBytes.get();
    }

    public long segmentCount() {
        return segmentsWritten.get();
    }

    public int encoderErrorCount() {
        return encoderErrors.get();
    }

    public String lastError() {
        return lastError;
    }

    /** Average cost of the readback on the render thread: the number the FPS budget cares about. */
    public double averageReadbackMillis() {
        long samples = readbackSamples.get();
        return samples == 0L ? 0.0 : readbackNanos.get() / (double) samples / 1_000_000.0;
    }

    /** Average encode cost per frame on worker threads. */
    public double averageEncodeMillis() {
        long frames = encodedFrames.get();
        return frames == 0L ? 0.0 : encodeNanos.get() / (double) frames / 1_000_000.0;
    }

    /**
     * Frames per second actually captured, measured from timestamps.
     *
     * <p>This is the number shown to the user, and the number written into a clip's metadata. A
     * target of 120 means nothing if the game only rendered 48.
     */
    public double measuredCaptureFps() {
        long first = firstCaptureNanos;
        long last = lastCaptureNanos;
        long frames = capturedFrames.get();
        if (first < 0L || frames < 2L || last <= first) {
            return 0.0;
        }
        return (frames - 1) * 1_000_000_000.0 / (last - first);
    }

    public double dropRate() {
        long attempts = captureAttempts.get();
        return attempts == 0L ? 0.0 : droppedFrameCount() / (double) attempts;
    }
}
