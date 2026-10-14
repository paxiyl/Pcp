package com.pcpclip.core.segment;

import com.pcpclip.core.codec.SegmentCodec;

import java.io.File;

/** Metadata for one finished (or in-progress) buffer segment on disk. */
public final class SegmentHandle {

    public final File file;
    public final long index;
    public final SegmentCodec codec;
    public final int width;
    public final int height;
    public final int targetFps;
    public final long startEpochMillis;

    private long startPtsNanos;
    private long endPtsNanos;
    private int frameCount;
    private long bytes;
    private boolean finished;

    /**
     * Number of exports currently reading this segment. Only touched while the owning
     * {@link SegmentStore}'s lock is held; a locked segment is never pruned out from under a
     * clip that is still being written.
     */
    int locks;

    public SegmentHandle(File file, long index, SegmentCodec codec, int width, int height,
                         int targetFps, long startEpochMillis, long startPtsNanos) {
        this.file = file;
        this.index = index;
        this.codec = codec;
        this.width = width;
        this.height = height;
        this.targetFps = targetFps;
        this.startEpochMillis = startEpochMillis;
        this.startPtsNanos = startPtsNanos;
        this.endPtsNanos = startPtsNanos;
    }

    public long startPtsNanos() {
        return startPtsNanos;
    }

    public long endPtsNanos() {
        return endPtsNanos;
    }

    public long durationNanos() {
        return Math.max(0L, endPtsNanos - startPtsNanos);
    }

    public int frameCount() {
        return frameCount;
    }

    public long bytes() {
        return bytes;
    }

    public boolean finished() {
        return finished;
    }

    void recordFrame(long ptsNanos, int payloadBytes, boolean first) {
        if (first) {
            startPtsNanos = ptsNanos;
        }
        endPtsNanos = Math.max(endPtsNanos, ptsNanos);
        frameCount++;
        bytes += payloadBytes;
    }

    void markFinished(long fileBytes) {
        finished = true;
        bytes = fileBytes;
    }

    /** Used by crash recovery, where counters come from a scan rather than from writing. */
    void restore(long startPts, long endPts, int frames, long fileBytes) {
        this.startPtsNanos = startPts;
        this.endPtsNanos = endPts;
        this.frameCount = frames;
        this.bytes = fileBytes;
        this.finished = true;
    }

    public boolean delete() {
        return !file.exists() || file.delete();
    }

    @Override
    public String toString() {
        return "segment#" + index + "[" + frameCount + " frames, " + durationNanos() / 1000000L
                + "ms, " + bytes + "B]";
    }
}
