package com.pcpclip.core.pipeline;

import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.mux.AviMjpegMuxer;
import com.pcpclip.core.mux.Mp4H264Muxer;
import com.pcpclip.core.mux.Muxer;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentReader;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.io.IOException;

/**
 * Turns a run of buffer segments into a finished clip file.
 *
 * <p>Runs on the export thread, never on the render thread and never on an encoder worker, so
 * saving a clip cannot stutter the game or stall the live buffer. Nothing is re-encoded: the
 * already-encoded frames are copied into a container, which is why a save finishes in a moment
 * even for a two-minute clip.
 *
 * <p>Trimming differs by codec, and the result says which happened. Motion JPEG frames are
 * independent so the clip starts exactly where asked. H.264 frames depend on the keyframe at the
 * start of their segment, so a clip can only begin on a segment boundary - it may therefore be up
 * to one segment longer than requested, which is better than starting with a broken picture.
 */
public final class ClipExporter {

    /** Export settings for one clip. */
    public static final class Options {

        public final boolean fixedFrameRate;
        public final int targetFps;

        public Options(boolean fixedFrameRate, int targetFps) {
            this.fixedFrameRate = fixedFrameRate;
            this.targetFps = Math.max(1, targetFps);
        }
    }

    /** What came out, including the facts the UI needs to be honest about. */
    public static final class Result {

        public final boolean success;
        public final File file;
        public final int frames;
        public final double durationSeconds;
        public final double measuredFps;
        public final long bytes;
        public final boolean trimmedToSegmentBoundary;
        public final boolean fixedRateApplied;
        /** True when the source timestamps did not advance and had to be synthesised. */
        public final boolean degenerateTimestamps;
        public final String message;

        Result(boolean success, File file, int frames, double durationSeconds, double measuredFps,
               long bytes, boolean trimmedToSegmentBoundary, boolean fixedRateApplied,
               boolean degenerateTimestamps, String message) {
            this.success = success;
            this.file = file;
            this.frames = frames;
            this.durationSeconds = durationSeconds;
            this.measuredFps = measuredFps;
            this.bytes = bytes;
            this.trimmedToSegmentBoundary = trimmedToSegmentBoundary;
            this.fixedRateApplied = fixedRateApplied;
            this.degenerateTimestamps = degenerateTimestamps;
            this.message = message;
        }

        static Result failed(String message) {
            return new Result(false, null, 0, 0.0, 0.0, 0L, false, false, false, message);
        }
    }

    private ClipExporter() {
    }

    public static Result export(SegmentStore.Selection selection, File target, SegmentCodec codec,
                                int width, int height, int nominalFps, Options options) {
        if (selection == null || selection.isEmpty()) {
            return Result.failed("Nothing in the buffer yet.");
        }

        Muxer muxer = null;
        boolean trimmedToBoundary = false;
        boolean fixedRate = options.fixedFrameRate && codec == SegmentCodec.MJPEG;
        try {
            muxer = codec == SegmentCodec.H264
                    ? new Mp4H264Muxer(target, width, height, nominalFps)
                    : new AviMjpegMuxer(target, width, height, nominalFps);

            long from = selection.fromPtsNanos;
            long to = selection.toPtsNanos;
            long firstWrittenPts = -1L;
            long lastWrittenPts = 0L;
            int written = 0;

            // Fixed-rate state: sample and hold the most recent frame onto an even grid.
            long interval = 1_000_000_000L / options.targetFps;
            long nextSlot = 0L;
            byte[] held = null;
            int heldLength = 0;
            long previousOutPts = Long.MIN_VALUE;
            boolean degenerate = false;

            for (SegmentHandle handle : selection.segments) {
                boolean skipWholeSegment = handle.endPtsNanos() < from || handle.startPtsNanos() > to;
                if (skipWholeSegment) {
                    continue;
                }
                boolean partialStart = handle.startPtsNanos() < from;
                if (partialStart && codec == SegmentCodec.H264) {
                    // Keep the whole segment: its leading keyframe is what makes it decodable.
                    trimmedToBoundary = true;
                }
                SegmentReader reader = null;
                try {
                    reader = new SegmentReader(handle.file);
                    while (reader.next()) {
                        long pts = reader.ptsNanos();
                        if (pts > to) {
                            break;
                        }
                        if (codec == SegmentCodec.MJPEG && pts < from) {
                            continue;
                        }
                        if (firstWrittenPts < 0L) {
                            firstWrittenPts = pts;
                            nextSlot = 0L;
                        }
                        long outPts = pts - firstWrittenPts;

                        if (!fixedRate) {
                            muxer.writeFrame(reader.payload(), 0, reader.payloadLength(), outPts,
                                    reader.keyframe());
                            written++;
                        } else {
                            boolean emitted = false;
                            while (nextSlot <= outPts) {
                                byte[] payload = held != null ? held : reader.payload();
                                int length = held != null ? heldLength : reader.payloadLength();
                                muxer.writeFrame(payload, 0, length, nextSlot, true);
                                written++;
                                nextSlot += interval;
                                emitted = true;
                            }
                            if (!emitted && outPts == previousOutPts) {
                                // Timestamps are not advancing at all, so the sample-and-hold loop
                                // above would emit one frame for the whole clip. Fall back to one
                                // output frame per input frame: the timing is invented, but the
                                // footage survives, and the result says so.
                                muxer.writeFrame(reader.payload(), 0, reader.payloadLength(),
                                        nextSlot, true);
                                written++;
                                nextSlot += interval;
                                degenerate = true;
                            }
                            previousOutPts = outPts;
                            if (held == null || held.length < reader.payloadLength()) {
                                held = new byte[reader.payloadLength()];
                            }
                            System.arraycopy(reader.payload(), 0, held, 0, reader.payloadLength());
                            heldLength = reader.payloadLength();
                        }
                        lastWrittenPts = outPts;
                    }
                } finally {
                    if (reader != null) {
                        reader.close();
                    }
                }
            }

            if (fixedRate && held != null) {
                // Hold the last frame out to the end of the requested span.
                while (nextSlot <= lastWrittenPts) {
                    muxer.writeFrame(held, 0, heldLength, nextSlot, true);
                    written++;
                    nextSlot += interval;
                }
            }

            if (written == 0) {
                muxer.close();
                return Result.failed("The buffer held no frames for that span.");
            }

            muxer.finish();
            double duration = lastWrittenPts > 0L ? lastWrittenPts / 1_000_000_000.0
                    : written / (double) nominalFps;
            double measured = duration > 0.0 && written > 1 ? (written - 1) / duration : nominalFps;

            if (degenerate) {
                // Re-time the whole clip on the grid we actually wrote it on.
                duration = written * (interval / 1_000_000_000.0);
                measured = options.targetFps;
                PcpLog.warn("Clip timestamps did not advance; exported " + written
                        + " frames on a synthetic " + options.targetFps + " fps timeline");
            }
            return new Result(true, target, written, duration, measured, target.length(),
                    trimmedToBoundary, fixedRate, degenerate, "Saved " + target.getName());
        } catch (IOException error) {
            PcpLog.error("Could not write " + target, error);
            if (muxer != null) {
                muxer.close();
            }
            return Result.failed("Could not write the clip: " + error.getMessage());
        } catch (RuntimeException error) {
            PcpLog.error("Export failed for " + target, error);
            if (muxer != null) {
                muxer.close();
            }
            return Result.failed("Export failed: " + error);
        }
    }
}
