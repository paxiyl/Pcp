package com.pcpclip.test;

import com.pcpclip.core.config.AspectPreset;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.Corner;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.config.ResolutionPreset;

import java.io.File;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkEquals;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/** Settings must survive a restart and must reject nonsense with a message, not a crash. */
final class ConfigTests {

    private ConfigTests() {
    }

    static void run() throws IOException {
        File directory = TestSupport.tempDirectory("pcpclip-config");
        try {
            startTest("config: defaults are the performance-focused ones");
            ClipConfig defaults = new ClipConfig();
            check(defaults.modEnabled, "the mod is enabled by default");
            check(!defaults.shadowBuffer, "the rolling buffer is OFF by default (zero idle cost)");
            checkEquals(720, defaults.resolutionPreset.height(), "default capture is 720p");
            checkEquals(30, defaults.targetFps, "default capture is 30 fps");
            check(defaults.performanceSaver, "the performance saver is on by default");
            check(!defaults.audioEnabled, "audio is off (it is not available here)");
            check(defaults.fitMode == FitMode.CROP, "default fit mode is crop");

            startTest("config: round trip through a file");
            ClipConfig original = new ClipConfig();
            original.shadowBuffer = true;
            original.shadowBufferSeconds = 60;
            original.clipSeconds = 15;
            original.resolutionPreset = ResolutionPreset.P1080;
            original.aspectPreset = AspectPreset.R21_9;
            original.targetFps = 120;
            original.fitMode = FitMode.LETTERBOX;
            original.encoder = EncoderPreference.MJPEG_AVI;
            original.bitrateKbps = 12000;
            original.jpegQuality = 80;
            original.h264Qp = 22;
            original.fixedFrameRateExport = true;
            original.performanceSaver = false;
            original.encoderThreads = 2;
            original.captureMemoryBudgetMb = 96;
            original.segmentMillis = 1500;
            original.showIndicator = false;
            original.indicatorCorner = Corner.BOTTOM_RIGHT;
            original.showStats = true;
            original.clipDirectory = "/sdcard/clips";
            original.minFreeSpaceMb = 1024;

            File file = new File(directory, "pcpclip.cfg");
            check(original.save(file), "config saved");
            ClipConfig loaded = ClipConfig.load(file);

            check(loaded.shadowBuffer, "buffer flag survived");
            checkEquals(60, loaded.shadowBufferSeconds, "buffer length survived");
            checkEquals(15, loaded.clipSeconds, "clip length survived");
            check(loaded.resolutionPreset == ResolutionPreset.P1080, "resolution survived");
            check(loaded.aspectPreset == AspectPreset.R21_9, "aspect survived");
            checkEquals(120, loaded.targetFps, "frame rate survived");
            check(loaded.fitMode == FitMode.LETTERBOX, "fit mode survived");
            check(loaded.encoder == EncoderPreference.MJPEG_AVI, "encoder choice survived");
            checkEquals(12000, loaded.bitrateKbps, "bitrate survived");
            checkEquals(80, loaded.jpegQuality, "jpeg quality survived");
            checkEquals(22, loaded.h264Qp, "quantiser survived");
            check(loaded.fixedFrameRateExport, "fixed rate flag survived");
            check(!loaded.performanceSaver, "performance saver flag survived");
            checkEquals(2, loaded.encoderThreads, "thread count survived");
            checkEquals(96, loaded.captureMemoryBudgetMb, "memory budget survived");
            checkEquals(1500, loaded.segmentMillis, "segment length survived");
            check(!loaded.showIndicator, "indicator flag survived");
            check(loaded.indicatorCorner == Corner.BOTTOM_RIGHT, "indicator corner survived");
            check(loaded.showStats, "stats flag survived");
            checkEquals(1024, loaded.minFreeSpaceMb, "free space floor survived");
            check("/sdcard/clips".equals(loaded.clipDirectory), "clip folder survived");

            startTest("config: nonsense is clamped and reported, not obeyed");
            ClipConfig bad = new ClipConfig();
            bad.targetFps = 9000;
            bad.shadowBufferSeconds = -5;
            bad.clipSeconds = 10000;
            bad.customWidth = 99999;
            bad.jpegQuality = 500;
            bad.segmentMillis = 10;
            bad.audioEnabled = true;
            List<String> messages = bad.validate();
            checkEquals(240, bad.targetFps, "frame rate clamped to the maximum");
            checkEquals(5, bad.shadowBufferSeconds, "buffer length clamped to the minimum");
            checkEquals(300, bad.clipSeconds, "clip length clamped");
            checkEquals(3840, bad.customWidth, "custom width clamped");
            checkEquals(100, bad.jpegQuality, "jpeg quality clamped");
            checkEquals(500, bad.segmentMillis, "segment length clamped");
            check(!bad.audioEnabled, "audio forced back off");
            check(messages.size() >= 6, "every correction produced a message for the user");
            note(messages.size() + " validation messages, first: " + messages.get(0));

            startTest("config: unreadable values fall back instead of throwing");
            File broken = new File(directory, "broken.cfg");
            PrintWriter out = new PrintWriter(broken, "UTF-8");
            out.println("video.fps=not-a-number");
            out.println("buffer.enabled=perhaps");
            out.println("video.resolution=P4320");
            out.println("video.aspect=R99_1");
            out.println("performance.encoderThreads=3 # with a comment");
            out.close();
            ClipConfig recovered = ClipConfig.load(broken);
            checkEquals(30, recovered.targetFps, "bad number fell back to the default");
            check(!recovered.shadowBuffer, "bad boolean fell back to the default");
            check(recovered.resolutionPreset == ResolutionPreset.P720, "unknown preset fell back");
            check(recovered.aspectPreset == AspectPreset.R16_9, "unknown aspect fell back");
            checkEquals(3, recovered.encoderThreads, "trailing comments are tolerated");

            startTest("config: a missing file is simply defaults");
            ClipConfig absent = ClipConfig.load(new File(directory, "nope.cfg"));
            checkEquals(30, absent.targetFps, "defaults used when there is no file");

            startTest("config: copy is independent");
            ClipConfig source = new ClipConfig();
            source.targetFps = 60;
            ClipConfig copy = source.copy();
            source.targetFps = 30;
            checkEquals(60, copy.targetFps, "the copy kept its own value");

            startTest("config: unsupported fit mode resolves to a safe one");
            ClipConfig viewport = new ClipConfig();
            viewport.fitMode = FitMode.VIEWPORT;
            check(viewport.effectiveFitMode() == FitMode.LETTERBOX,
                    "custom viewport falls back to letterbox");
            check(viewport.validate().size() >= 1, "and the user is told");
        } finally {
            TestSupport.deleteTree(directory);
        }
    }
}
