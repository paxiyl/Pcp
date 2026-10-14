package com.pcpclip.test;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.perf.LoadMonitor;
import com.pcpclip.core.pipeline.ClipExporter;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.segment.SegmentWriter;

import java.io.File;
import java.io.IOException;
import java.util.Map;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkEquals;
import static com.pcpclip.test.TestSupport.checkNear;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/**
 * Guards against the failure that produced the first on-device clips: every one of them held a
 * single frame.
 *
 * <p>The cause was upstream - a capture path that handed every frame the same timestamp - but the
 * reason it reached a file instead of being obvious is that nothing downstream objected. Segment
 * rotation waits on presentation time, so it never rotated; the fixed-rate export samples onto a
 * grid, so one frame filled the whole grid. These tests pin down the new behaviour: nothing
 * silently collapses, and a bad timestamp is reported rather than obeyed.
 */
final class RobustnessTests {

    private RobustnessTests() {
    }

    private static final long SECOND = 1_000_000_000L;

    static void run() throws IOException {
        encoderRateCap();
        degenerateTimestampsStillExport();
        repeatedTimestampsAreCorrectedAndCounted();
    }

    /** The capture rate is capped at what the encoders have actually been absorbing. */
    private static void encoderRateCap() {
        startTest("optimisation: capture rate is capped at measured encoder throughput");

        // Not enough evidence yet: do not throttle on a handful of frames.
        checkEquals(120, LoadMonitor.sustainableFps(120, 50.0, 2, 5),
                "no cap until enough frames have been measured");

        // 50 ms per frame on 2 workers is 40 frames a second; 85% of that is 34.
        checkEquals(34, LoadMonitor.sustainableFps(120, 50.0, 2, 500),
                "120 fps asked, 50 ms/frame on 2 workers");
        note("720p120 on a phone-like encoder (50 ms/frame, 2 workers) -> "
                + LoadMonitor.sustainableFps(120, 50.0, 2, 500) + " fps requested");

        // A fast encoder must not be throttled below what was asked for.
        checkEquals(30, LoadMonitor.sustainableFps(30, 5.0, 3, 500),
                "a fast encoder leaves the target alone");
        checkEquals(60, LoadMonitor.sustainableFps(60, 4.0, 1, 500),
                "one fast worker still sustains 60");

        // A catastrophically slow encoder still leaves a usable trickle.
        check(LoadMonitor.sustainableFps(120, 5000.0, 1, 500) >= 5,
                "never clamps below 5 fps");
        checkEquals(120, LoadMonitor.sustainableFps(120, 0.0, 2, 500),
                "an unmeasured encode cost is not treated as infinitely fast");
    }

    /**
     * A clip whose source timestamps never advance must still contain every frame.
     *
     * <p>This is exactly what the first on-device clips hit: with fixed-rate export on, the
     * sample-and-hold loop emitted one frame for the entire clip.
     */
    private static void degenerateTimestampsStillExport() throws IOException {
        startTest("robustness: frozen timestamps still export every frame");
        File directory = TestSupport.tempDirectory("pcpclip-degenerate");
        try {
            // 40 frames that all claim the same instant, as a broken capture path would produce.
            File file = new File(directory, "seg-000000.pcpseg");
            SegmentWriter writer = new SegmentWriter(file, 0L, SegmentCodec.MJPEG, 64, 64, 30, 0L);
            byte[] payload = smallJpeg();
            for (int i = 0; i < 40; i++) {
                writer.packet(payload, 0, payload.length, 0L, true);
            }
            SegmentHandle handle = writer.finish(false);
            checkEquals(40, handle.frameCount(), "all forty frames were stored");
            checkEquals(0L, handle.durationNanos(), "and they all claim the same instant");

            SegmentStore store = new SegmentStore(directory, 0L, 0L);
            store.add(handle);
            SegmentStore.Selection selection = store.selectRange(0L, Long.MAX_VALUE);

            File target = new File(directory, "degenerate.avi");
            ClipExporter.Result result = ClipExporter.export(selection, target, SegmentCodec.MJPEG,
                    64, 64, 30, new ClipExporter.Options(true, 30));
            store.release(selection);

            check(result.success, "export succeeded: " + result.message);
            note("exported " + result.frames + " frames, " + result.durationSeconds + "s, "
                    + "degenerate=" + result.degenerateTimestamps);
            checkEquals(40, result.frames, "every frame survived instead of collapsing to one");
            check(result.degenerateTimestamps, "and the result reports the invented timing");
            checkNear(40.0 / 30.0, result.durationSeconds, 0.1,
                    "the clip is as long as the synthesised timeline says");

            if (Ffprobe.available()) {
                Map<String, String> probed = Ffprobe.probe(target);
                check(probed != null, "ffprobe read the clip");
                if (probed != null) {
                    checkEquals(40, Long.parseLong(probed.get("nb_read_frames")),
                            "ffprobe decodes all forty frames");
                }
            }
        } finally {
            TestSupport.deleteTree(directory);
        }
    }

    /**
     * The pipeline nudges a repeated timestamp forward and counts it, rather than letting it stall
     * segment rotation.
     */
    private static void repeatedTimestampsAreCorrectedAndCounted() throws IOException {
        startTest("robustness: repeated capture timestamps are corrected and reported");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-frozen");
        ClipConfig config = new ClipConfig();
        config.shadowBuffer = true;
        config.shadowBufferSeconds = 10;
        config.clipSeconds = 5;
        config.resolutionPreset = com.pcpclip.core.config.ResolutionPreset.CUSTOM;
        config.customWidth = 320;
        config.customHeight = 180;
        config.targetFps = 30;
        config.encoder = EncoderPreference.MJPEG_AVI;
        config.segmentMillis = 500;
        config.performanceSaver = false;
        config.validate();

        final java.util.List<String> errors = new java.util.ArrayList<String>();
        ClipEngine engine = new ClipEngine(gameDirectory, config, new ClipEngine.Events() {
            @Override
            public void toast(String message) {
            }

            @Override
            public void error(String message) {
                errors.add(message);
            }
        });
        try {
            engine.notifySourceSize(640, 360);
            check(engine.ensureBuffering(false), "buffer started");

            // Feed frames whose timestamps never move, the way a broken readback would.
            int fed = 0;
            for (int i = 0; i < 40; i++) {
                com.pcpclip.core.frame.VideoFrame frame = engine.acquireFrame();
                if (frame == null) {
                    continue;
                }
                TestSupport.fillFrame(frame.pixels(), frame.width(), frame.height(), i);
                frame.setPtsNanos(0L);                 // the fault being simulated
                engine.submitFrame(frame, 1_000_000L);
                fed++;
                try {
                    Thread.sleep(20L);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }

            ClipEngine.Status status = engine.status();
            note("fed " + fed + " frames with a frozen timestamp; corrected "
                    + status.timestampAnomalies + ", buffered "
                    + String.format("%.2f", status.bufferedSeconds) + "s in "
                    + status.segments + " segment(s)");
            check(status.timestampAnomalies >= fed - 1,
                    "every repeated timestamp was counted (" + status.timestampAnomalies + ")");
            check(status.bufferedSeconds > 0.0,
                    "the buffer still advanced, so segments can still rotate");
            check(errors.isEmpty(), "and nothing failed: " + errors);
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    /** A tiny valid JPEG, so the exported AVI holds something a decoder will accept. */
    private static byte[] smallJpeg() throws IOException {
        java.awt.image.BufferedImage image =
                new java.awt.image.BufferedImage(64, 64, java.awt.image.BufferedImage.TYPE_3BYTE_BGR);
        for (int y = 0; y < 64; y++) {
            for (int x = 0; x < 64; x++) {
                image.setRGB(x, y, (x * 4) << 16 | (y * 4) << 8 | 0x40);
            }
        }
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "jpeg", bytes);
        return bytes.toByteArray();
    }
}
