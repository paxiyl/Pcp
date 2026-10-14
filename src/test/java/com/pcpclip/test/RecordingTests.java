package com.pcpclip.test;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.config.ResolutionPreset;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.storage.ClipEntry;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkEquals;
import static com.pcpclip.test.TestSupport.checkNear;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/**
 * Drives the whole engine with synthetic frames - the closest thing to a recording session that
 * can run without Minecraft - and verifies the resulting files with ffprobe.
 */
final class RecordingTests {

    private RecordingTests() {
    }

    /** Collects the engine's user-facing messages so the tests can assert on them. */
    private static final class Recorder implements ClipEngine.Events {

        final List<String> toasts = Collections.synchronizedList(new ArrayList<String>());
        final List<String> errors = Collections.synchronizedList(new ArrayList<String>());

        @Override
        public void toast(String message) {
            toasts.add(message);
        }

        @Override
        public void error(String message) {
            errors.add(message);
        }

        boolean sawToastContaining(String fragment) {
            synchronized (toasts) {
                for (String toast : toasts) {
                    if (toast.contains(fragment)) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    static void run() throws IOException {
        rollingBufferClip(EncoderPreference.MJPEG_AVI, "avi", "mjpeg");
        rollingBufferClip(EncoderPreference.H264_MP4, "mp4", "h264");
        manualRecording();
        clipFolderCap();
        recordingOutlivesTheBufferWindow();
        boundedUnderLoad();
        longRunStaysBounded();
        refusesWithoutBuffer();
    }

    private static ClipConfig smallConfig(EncoderPreference encoder) {
        ClipConfig config = new ClipConfig();
        config.shadowBuffer = true;
        config.shadowBufferSeconds = 10;
        config.clipSeconds = 3;
        config.resolutionPreset = ResolutionPreset.CUSTOM;
        config.customWidth = 480;
        config.customHeight = 270;
        config.targetFps = 20;
        config.encoder = encoder;
        config.jpegQuality = 50;
        config.h264Qp = 30;
        config.segmentMillis = 700;
        config.performanceSaver = false;
        config.captureMemoryBudgetMb = 24;
        config.fitMode = FitMode.CROP;
        config.minFreeSpaceMb = 64;
        config.validate();
        return config;
    }

    /** Feeds frames for roughly the requested time, as a real render loop would. */
    private static int feed(ClipEngine engine, int sourceWidth, int sourceHeight, long millis) {
        long deadline = System.currentTimeMillis() + millis;
        int captured = 0;
        int frame = 0;
        while (System.currentTimeMillis() < deadline) {
            engine.notifyFrameTime(16_000_000L);
            if (engine.wantsCapture()) {
                VideoFrame videoFrame = engine.acquireFrame();
                if (videoFrame != null) {
                    TestSupport.fillFrame(videoFrame.pixels(), videoFrame.width(),
                            videoFrame.height(), frame++);
                    engine.submitFrame(videoFrame, 1_000_000L);
                    captured++;
                }
            }
            try {
                Thread.sleep(4L);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return captured;
    }

    /**
     * Waits for the engine to report a finished save, then reads the clip back.
     *
     * <p>Waiting on the message rather than on the file's existence is deliberate: it is also the
     * assertion that a clip only becomes visible once it is complete.
     */
    private static ClipEntry waitForClip(ClipEngine engine, Recorder events, long timeoutMillis) {
        long deadline = System.currentTimeMillis() + timeoutMillis;
        while (System.currentTimeMillis() < deadline) {
            if (events.sawToastContaining("Clip saved")) {
                List<ClipEntry> clips = engine.library().list();
                if (!clips.isEmpty()) {
                    return clips.get(0);
                }
            }
            try {
                Thread.sleep(50L);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return null;
    }

    private static void rollingBufferClip(EncoderPreference encoder, String extension,
                                          String expectedCodec) throws IOException {
        startTest("recording: rolling buffer clip via " + encoder.label());
        File gameDirectory = TestSupport.tempDirectory("pcpclip-game");
        Recorder events = new Recorder();
        ClipEngine engine = new ClipEngine(gameDirectory, smallConfig(encoder), events);
        try {
            engine.setContextLabel("TestWorld");
            engine.notifySourceSize(960, 540);
            check(engine.ensureBuffering(false), "buffer started");
            check(engine.mode() == ClipEngine.Mode.BUFFERING, "engine reports buffering");

            int captured = feed(engine, 960, 540, 4000L);
            note("fed " + captured + " frames; status: measured "
                    + Math.round(engine.status().measuredFps) + " fps, backlog "
                    + engine.status().backlog + ", dropped " + engine.status().droppedFrames);
            check(captured > 20, "frames were captured (" + captured + ")");
            check(engine.status().bufferedSeconds > 1.0,
                    "the buffer holds real footage (" + engine.status().bufferedSeconds + "s)");

            engine.saveRollingClip(3);
            ClipEntry clip = waitForClip(engine, events, 20000L);
            check(clip != null, "a clip file appeared");
            if (clip == null) {
                note("errors: " + events.errors);
                return;
            }
            note("clip: " + clip.name() + "  " + clip.summary());
            check(clip.name().endsWith("." + extension), "clip uses the right container");
            check(clip.name().contains("TestWorld"), "clip is named after the world");
            check(clip.sizeBytes > 5000L, "clip is not empty");
            checkEquals(480, clip.width, "clip width matches the configured output");
            checkEquals(270, clip.height, "clip height matches the configured output");
            check(events.sawToastContaining("Clip saved"), "the user was told it was saved");

            File sidecar = engine.library().sidecarFor(clip.file);
            check(sidecar.isFile(), "capture details were written beside the clip");

            if (Ffprobe.available()) {
                Map<String, String> probed = Ffprobe.probe(clip.file);
                check(probed != null, "ffprobe could read the clip");
                if (probed != null) {
                    note("ffprobe: " + probed);
                    check(expectedCodec.equals(probed.get("codec_name")),
                            "ffprobe reports " + expectedCodec + ", got " + probed.get("codec_name"));
                    checkEquals(480, Long.parseLong(probed.get("width")), "ffprobe width");
                    checkEquals(270, Long.parseLong(probed.get("height")), "ffprobe height");
                    long frames = Long.parseLong(probed.get("nb_read_frames"));
                    check(frames > 10, "ffprobe decoded " + frames + " frames");
                    double duration = Double.parseDouble(probed.get("duration"));
                    checkNear(3.0, duration, 1.6, "clip is about the requested 3 seconds");
                }
                check(Ffprobe.decodes(clip.file), "every frame decodes without an error");
            } else {
                note("ffprobe not available; skipping independent verification");
            }
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    private static void manualRecording() throws IOException {
        startTest("recording: manual start, pause, resume, stop");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-manual");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.MJPEG_AVI);
        config.shadowBuffer = false;                     // manual recording with no rolling buffer
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            engine.notifySourceSize(640, 360);
            check(!engine.ensureBuffering(false), "no buffer runs while it is switched off");
            checkEquals(0, engine.status().segments, "nothing is cached while idle");

            engine.startRecording(false);
            check(engine.mode() == ClipEngine.Mode.RECORDING, "recording started");
            feed(engine, 640, 360, 1500L);

            engine.pauseRecording();
            check(engine.mode() == ClipEngine.Mode.PAUSED, "recording paused");
            int whilePaused = feed(engine, 640, 360, 500L);
            checkEquals(0, whilePaused, "no frames are captured while paused");

            engine.resumeRecording();
            check(engine.mode() == ClipEngine.Mode.RECORDING, "recording resumed");
            feed(engine, 640, 360, 1500L);

            engine.stopRecording();
            ClipEntry clip = waitForClip(engine, events, 20000L);
            check(clip != null, "the recording was written out");
            if (clip != null) {
                note("clip: " + clip.name() + "  " + clip.summary());
                // Two 1.5 s bursts with a pause between them: the pause must not appear as time.
                checkNear(3.0, clip.durationSeconds, 1.5, "paused time is excluded from the clip");
                if (Ffprobe.available()) {
                    check(Ffprobe.decodes(clip.file), "the recording decodes cleanly");
                }
            }
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    /**
     * A manual recording longer than the rolling buffer must keep its beginning.
     *
     * <p>This is the case a retention mark exists for: the rolling buffer prunes anything older
     * than its window, but a recording in progress has asked for those frames. It also covers the
     * ordering around the export - retention may only be released once the export has locked the
     * segments it needs, or the start of the recording is pruned before it is written.
     */
    private static void recordingOutlivesTheBufferWindow() throws IOException {
        startTest("recording: a recording longer than the buffer keeps its start");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-outlive");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.MJPEG_AVI);
        config.shadowBuffer = true;
        config.shadowBufferSeconds = 5;       // the minimum, far shorter than the recording
        config.segmentMillis = 500;
        config.customWidth = 320;
        config.customHeight = 180;
        config.validate();
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            engine.notifySourceSize(640, 360);
            check(engine.ensureBuffering(false), "buffer started");

            engine.startRecording(false);
            check(engine.mode() == ClipEngine.Mode.RECORDING, "recording started");
            // Record for noticeably longer than the five second buffer window.
            feed(engine, 640, 360, 8000L);
            ClipEngine.Status during = engine.status();
            note("while recording: " + during.segments + " segments, "
                    + Math.round(during.bufferedSeconds) + "s retained (buffer window is "
                    + config.shadowBufferSeconds + "s)");
            check(during.bufferedSeconds > 6.0,
                    "retention kept more than the buffer window (" + during.bufferedSeconds + "s)");

            engine.stopRecording();
            ClipEntry clip = waitForClip(engine, events, 30000L);
            check(clip != null, "the recording was written out");
            if (clip != null) {
                note("clip: " + clip.name() + "  " + clip.summary());
                check(clip.durationSeconds > 6.0,
                        "the whole recording was saved, not just the buffer window ("
                                + clip.durationSeconds + "s)");
                if (Ffprobe.available()) {
                    check(Ffprobe.decodes(clip.file), "the long recording decodes cleanly");
                }
            }

            // Once the export is done, retention is released and pruning resumes.
            long deadline = System.currentTimeMillis() + 5000L;
            while (System.currentTimeMillis() < deadline && engine.status().bufferedSeconds > 7.0) {
                feed(engine, 640, 360, 500L);
            }
            note("after the save: " + Math.round(engine.status().bufferedSeconds) + "s buffered");
            check(engine.status().bufferedSeconds <= 7.5,
                    "pruning resumed once the recording was written");
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    /** The optional clip-folder cap: off by default, and only ever deletes the oldest clips. */
    private static void clipFolderCap() throws IOException {
        startTest("storage: the clip folder cap is off by default and prunes oldest when set");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-cap");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.MJPEG_AVI);
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            File clips = engine.storage().clipDirectory();
            // Three clip-shaped files of about 400 KB each, with distinct ages.
            byte[] filler = new byte[400 * 1024];
            File oldest = writeFile(new File(clips, "pcpclip-20200101-000000-old.avi"), filler);
            File middle = writeFile(new File(clips, "pcpclip-20250101-000000-mid.avi"), filler);
            File newest = writeFile(new File(clips, "pcpclip-20260101-000000-new.avi"), filler);
            long base = System.currentTimeMillis() - 100000L;
            check(oldest.setLastModified(base), "set age on the oldest clip");
            check(middle.setLastModified(base + 30000L), "set age on the middle clip");
            check(newest.setLastModified(base + 60000L), "set age on the newest clip");
            checkEquals(3, engine.library().list().size(), "three clips are listed");

            checkEquals(0, config.maxLibraryGb, "the cap is off by default");
            checkEquals(0, engine.library().pruneTo(0L).size(),
                    "a cap of zero never deletes anything");
            checkEquals(3, engine.library().list().size(), "all three clips survive");

            // A cap of 1 MB against about 1.2 MB of clips should remove exactly the oldest one.
            int removed = engine.library().pruneTo(1024L * 1024L).size();
            check(removed >= 1, "the cap removed something (" + removed + ")");
            check(!oldest.exists(), "the oldest clip was the one removed");
            check(newest.exists(), "the newest clip was kept");
            check(engine.library().totalBytes() <= 1024L * 1024L,
                    "the folder is back under its cap");
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    private static File writeFile(File file, byte[] contents) throws IOException {
        java.io.FileOutputStream out = new java.io.FileOutputStream(file);
        try {
            out.write(contents);
        } finally {
            out.close();
        }
        return file;
    }

    private static void boundedUnderLoad() throws IOException {
        startTest("recording: an overloaded encoder drops frames instead of growing");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-load");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.H264_MP4);
        // Deliberately far too much work: 1080p at 120 fps through a software encoder.
        config.resolutionPreset = ResolutionPreset.P1080;
        config.customWidth = 1920;
        config.customHeight = 1080;
        config.targetFps = 120;
        config.captureMemoryBudgetMb = 32;
        config.encoderThreads = 1;
        config.validate();
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            engine.notifySourceSize(1920, 1080);
            check(engine.ensureBuffering(true), "buffer started at the impossible preset");
            long heapBefore = usedHeap();
            feed(engine, 1920, 1080, 4000L);
            long heapAfter = usedHeap();

            ClipEngine.Status status = engine.status();
            note("attempted " + (status.capturedFrames + status.droppedFrames) + " captures, kept "
                    + status.capturedFrames + ", dropped " + status.droppedFrames
                    + " (" + Math.round(status.dropPercent) + "%), backlog " + status.backlog
                    + ", heap grew " + (heapAfter - heapBefore) / 1048576L + " MB");
            check(status.droppedFrames > 0, "frames were dropped rather than queued forever");
            check(status.backlog <= 16, "the backlog stayed small (" + status.backlog + ")");
            check(heapAfter - heapBefore < 160L * 1024L * 1024L,
                    "heap growth stayed bounded under sustained overload");
            check(events.errors.isEmpty(), "overload is handled without errors: " + events.errors);
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    private static void longRunStaysBounded() throws IOException {
        startTest("recording: a long session does not grow memory or storage");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-long");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.MJPEG_AVI);
        config.customWidth = 320;
        config.customHeight = 180;
        config.shadowBufferSeconds = 5;                  // a tiny buffer makes pruning obvious
        config.segmentMillis = 500;
        config.targetFps = 30;
        config.validate();
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            engine.notifySourceSize(640, 360);
            check(engine.ensureBuffering(false), "buffer started");
            feed(engine, 640, 360, 1500L);
            long bytesEarly = engine.status().bufferBytes;
            int segmentsEarly = engine.status().segments;

            feed(engine, 640, 360, 10000L);
            ClipEngine.Status late = engine.status();
            note("after 11s: " + late.segments + " segments, " + late.bufferBytes / 1024L
                    + " KB cached, " + Math.round(late.bufferedSeconds) + "s buffered"
                    + " (early: " + segmentsEarly + " segments, " + bytesEarly / 1024L + " KB)");
            check(late.bufferedSeconds <= 7.0,
                    "buffered span respects the 5s setting (" + late.bufferedSeconds + "s)");
            check(late.bufferBytes < Math.max(bytesEarly * 4L, 4L * 1024L * 1024L),
                    "cached bytes did not grow with session length");

            File cache = engine.storage().cacheDirectory();
            File[] cached = cache.listFiles();
            int cachedCount = cached == null ? 0 : cached.length;
            check(cachedCount <= late.segments + 2,
                    "no segment files leak on disk (" + cachedCount + " files)");
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    private static void refusesWithoutBuffer() throws IOException {
        startTest("recording: saving with the buffer off explains itself");
        File gameDirectory = TestSupport.tempDirectory("pcpclip-off");
        Recorder events = new Recorder();
        ClipConfig config = smallConfig(EncoderPreference.MJPEG_AVI);
        config.shadowBuffer = false;
        ClipEngine engine = new ClipEngine(gameDirectory, config, events);
        try {
            engine.notifySourceSize(640, 360);
            engine.saveRollingClip(10);
            check(!events.errors.isEmpty(), "the user is told why nothing was saved");
            if (!events.errors.isEmpty()) {
                note("message: " + events.errors.get(0));
                check(events.errors.get(0).toLowerCase().contains("buffer"),
                        "the message mentions the buffer");
            }
            check(engine.library().list().isEmpty(), "and no file was written");
        } finally {
            engine.shutdown();
            TestSupport.deleteTree(gameDirectory);
        }
    }

    private static long usedHeap() {
        Runtime runtime = Runtime.getRuntime();
        for (int i = 0; i < 3; i++) {
            System.gc();
            try {
                Thread.sleep(30L);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        return runtime.totalMemory() - runtime.freeMemory();
    }
}
