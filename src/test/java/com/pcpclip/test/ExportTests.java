package com.pcpclip.test;

import com.pcpclip.core.codec.EncoderFactory;
import com.pcpclip.core.codec.EncoderSpec;
import com.pcpclip.core.codec.PacketSink;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.codec.VideoEncoder;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.frame.FramePool;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.pipeline.ClipExporter;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.segment.SegmentWriter;

import java.io.File;
import java.io.IOException;
import java.util.Map;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkNear;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/** Trimming, timing and fixed-rate export, checked against real encoded segments. */
final class ExportTests {

    private ExportTests() {
    }

    private static final long SECOND = 1_000_000_000L;

    static void run() throws IOException {
        File directory = TestSupport.tempDirectory("pcpclip-export");
        try {
            trimsToTheRequestedSpan(directory);
            fixedRateFillsEverySlot(directory);
            h264KeepsKeyframeIntegrity(directory);
        } finally {
            TestSupport.deleteTree(directory);
        }
    }

    /**
     * Encodes real frames into real segments, so exports are exercised against the same files the
     * live pipeline writes.
     */
    private static SegmentStore buildSegments(File directory, EncoderPreference backend,
                                              int width, int height, int fps,
                                              int segments, double segmentSeconds)
            throws IOException {
        SegmentStore store = new SegmentStore(directory, 0L, 0L);
        OutputGeometry geometry = OutputGeometry.identity(width, height);
        FramePool pool = new FramePool(width * height * 4, 16L * 1024L * 1024L);
        int framesPerSegment = (int) Math.round(fps * segmentSeconds);
        long frameInterval = SECOND / fps;
        int frameNumber = 0;

        for (int s = 0; s < segments; s++) {
            long segmentStart = (long) (s * segmentSeconds * SECOND);
            EncoderSpec spec = new EncoderSpec(width, height, fps, 2000, 50, 32, backend);
            VideoEncoder encoder;
            try {
                encoder = EncoderFactory.create(spec, backend);
            } catch (Exception unavailable) {
                throw new IOException("encoder unavailable", unavailable);
            }
            File file = new File(directory, String.format("seg-%06d.pcpseg", s));
            final SegmentWriter writer = new SegmentWriter(file, s,
                    backend == EncoderPreference.H264_MP4 ? SegmentCodec.H264 : SegmentCodec.MJPEG,
                    width, height, fps, segmentStart);
            PacketSink sink = new PacketSink() {
                @Override
                public void packet(byte[] data, int offset, int length, long ptsNanos,
                                   boolean keyframe) throws IOException {
                    writer.packet(data, offset, length, ptsNanos, keyframe);
                }
            };
            for (int i = 0; i < framesPerSegment; i++) {
                long pts = segmentStart + i * frameInterval;
                VideoFrame frame = pool.acquire(width, height, geometry, pts, frameNumber);
                if (frame == null) {
                    throw new IOException("frame pool exhausted in a single-threaded test");
                }
                TestSupport.fillFrame(frame.pixels(), width, height, frameNumber++);
                encoder.encode(frame, sink);
                frame.release();
            }
            encoder.finish(sink);
            encoder.close();
            SegmentHandle handle = writer.finish(false);
            store.add(handle);
        }
        return store;
    }

    private static void trimsToTheRequestedSpan(File parent) throws IOException {
        startTest("export: Motion JPEG trims to the exact requested span");
        File directory = new File(parent, "trim");
        SegmentStore store = buildSegments(directory, EncoderPreference.MJPEG_AVI,
                320, 180, 20, 6, 1.0);          // 6 seconds of footage in 1-second segments

        // Ask for the last 2 seconds of a 6 second buffer.
        SegmentStore.Selection selection = store.selectRange(4L * SECOND, Long.MAX_VALUE);
        File target = new File(directory, "trimmed.avi");
        ClipExporter.Result result = ClipExporter.export(selection, target, SegmentCodec.MJPEG,
                320, 180, 20, new ClipExporter.Options(false, 20));
        store.release(selection);

        check(result.success, "export succeeded: " + result.message);
        note("exported " + result.frames + " frames, " + String.format("%.2f", result.durationSeconds)
                + "s, measured " + Math.round(result.measuredFps) + " fps");
        checkNear(2.0, result.durationSeconds, 0.25, "clip covers the requested two seconds");
        checkNear(40.0, result.frames, 4.0, "frame count matches two seconds at 20 fps");
        check(!result.trimmedToSegmentBoundary, "Motion JPEG needs no boundary compromise");

        if (Ffprobe.available()) {
            Map<String, String> probed = Ffprobe.probe(target);
            check(probed != null && "mjpeg".equals(probed.get("codec_name")),
                    "ffprobe sees a Motion JPEG stream");
            if (probed != null) {
                checkNear(2.0, Double.parseDouble(probed.get("duration")), 0.3,
                        "ffprobe agrees on the duration");
            }
        }
    }

    private static void fixedRateFillsEverySlot(File parent) throws IOException {
        startTest("export: fixed-rate mode fills every slot by duplicating frames");
        File directory = new File(parent, "fixed");
        // Capture at 10 fps, then export at 30: the gaps must be filled, not stretched.
        SegmentStore store = buildSegments(directory, EncoderPreference.MJPEG_AVI,
                320, 180, 10, 3, 1.0);

        SegmentStore.Selection selection = store.selectRange(0L, Long.MAX_VALUE);
        File target = new File(directory, "fixed.avi");
        ClipExporter.Result result = ClipExporter.export(selection, target, SegmentCodec.MJPEG,
                320, 180, 30, new ClipExporter.Options(true, 30));
        store.release(selection);

        check(result.success, "export succeeded: " + result.message);
        check(result.fixedRateApplied, "fixed-rate export was actually applied");
        note("captured 30 real frames at 10 fps, exported " + result.frames + " at 30 fps over "
                + String.format("%.2f", result.durationSeconds) + "s");
        check(result.frames > 70, "slots were filled with duplicates (" + result.frames + ")");
        checkNear(30.0, result.measuredFps, 3.0, "output really runs at the requested rate");
        checkNear(2.9, result.durationSeconds, 0.4, "and still covers the same wall-clock time");

        startTest("export: H.264 never fakes a fixed rate");
        File h264Directory = new File(parent, "fixed-h264");
        SegmentStore h264Store = buildSegments(h264Directory, EncoderPreference.H264_MP4,
                160, 96, 10, 2, 1.0);
        SegmentStore.Selection h264Selection = h264Store.selectRange(0L, Long.MAX_VALUE);
        File h264Target = new File(h264Directory, "fixed.mp4");
        ClipExporter.Result h264Result = ClipExporter.export(h264Selection, h264Target,
                SegmentCodec.H264, 160, 96, 30, new ClipExporter.Options(true, 30));
        h264Store.release(h264Selection);
        check(h264Result.success, "H.264 export succeeded: " + h264Result.message);
        check(!h264Result.fixedRateApplied,
                "fixed-rate export is reported as not applied for H.264 (frames cannot be "
                        + "duplicated without re-encoding)");
        checkNear(20.0, h264Result.frames, 1.0, "only the real frames are written");
    }

    private static void h264KeepsKeyframeIntegrity(File parent) throws IOException {
        startTest("export: H.264 clips start on a keyframe and decode from the first frame");
        File directory = new File(parent, "h264");
        SegmentStore store = buildSegments(directory, EncoderPreference.H264_MP4,
                320, 180, 20, 4, 1.0);

        // Ask for a span starting in the middle of a segment.
        SegmentStore.Selection selection = store.selectRange(1500 * 1000000L, Long.MAX_VALUE);
        File target = new File(directory, "clip.mp4");
        ClipExporter.Result result = ClipExporter.export(selection, target, SegmentCodec.H264,
                320, 180, 20, new ClipExporter.Options(false, 20));
        store.release(selection);

        check(result.success, "export succeeded: " + result.message);
        check(result.trimmedToSegmentBoundary,
                "the start was moved back to a keyframe and the result says so");
        note("requested from 1.5s, produced " + result.frames + " frames over "
                + String.format("%.2f", result.durationSeconds) + "s");
        check(result.durationSeconds >= 2.4, "no footage was lost by snapping to the boundary");

        if (Ffprobe.available()) {
            Map<String, String> probed = Ffprobe.probe(target);
            check(probed != null, "ffprobe read the clip");
            if (probed != null) {
                note("ffprobe: " + probed);
                check("h264".equals(probed.get("codec_name")), "stream is H.264");
                long decoded = Long.parseLong(probed.get("nb_read_frames"));
                check(decoded == result.frames,
                        "every written frame decodes (" + decoded + " of " + result.frames + ")");
            }
            check(Ffprobe.decodes(target), "no decoder errors anywhere in the clip");
        }
    }
}
