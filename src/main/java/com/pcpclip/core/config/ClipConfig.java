package com.pcpclip.core.config;

import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/**
 * Every user setting, with defaults chosen for performance rather than for the nicest looking
 * clip: the rolling buffer starts switched off, capture defaults to 720p30, and the performance
 * saver is on.
 *
 * <p>Values are plain fields. Reading them from the render thread must stay cheap, so there are no
 * getters doing work and no synchronisation; the render loop reads a snapshot through
 * {@link #copy()} whenever a recording session starts.
 */
public final class ClipConfig {

    public static final int FILE_VERSION = 1;

    public static final int MIN_BUFFER_SECONDS = 5;
    public static final int MAX_BUFFER_SECONDS = 300;
    public static final int MIN_FPS = 10;
    public static final int MAX_FPS = 240;
    public static final int MIN_DIMENSION = 160;
    public static final int MAX_DIMENSION = 3840;

    /** Durations offered by the save hotkey, as required by the clip menu. */
    public static final int[] CLIP_DURATION_CHOICES = {15, 30, 60, 120};

    // ---- master switches -------------------------------------------------------------------
    /** Master switch. When false the mod does no per-frame work at all. */
    public boolean modEnabled = true;
    /** Rolling "instant replay" buffer. Off by default: it is the only always-on cost. */
    public boolean shadowBuffer = false;
    /** How much recent gameplay the rolling buffer keeps. */
    public int shadowBufferSeconds = 30;
    /** Duration written by the save-clip hotkey. */
    public int clipSeconds = 30;

    // ---- video -----------------------------------------------------------------------------
    public ResolutionPreset resolutionPreset = ResolutionPreset.P720;
    public AspectPreset aspectPreset = AspectPreset.R16_9;
    public int customWidth = 1920;
    public int customHeight = 1080;
    public int customAspectWidth = 21;
    public int customAspectHeight = 9;
    public int targetFps = 30;
    public FitMode fitMode = FitMode.CROP;
    public EncoderPreference encoder = EncoderPreference.AUTO;
    /** Target bitrate for H.264 output. Also drives the storage estimate. */
    public int bitrateKbps = 4000;
    /** JPEG quality for the Motion JPEG backend, 1-100. */
    public int jpegQuality = 55;
    /** Fixed quantiser for the JCodec H.264 backend; lower is better quality, 10-40. */
    public int h264Qp = 26;
    /**
     * Re-time the export to exactly {@link #targetFps}, duplicating frames when the game rendered
     * fewer. Off by default, because the honest default is to store the frames that really existed.
     */
    public boolean fixedFrameRateExport = false;

    // ---- performance -----------------------------------------------------------------------
    /** Step capture quality down automatically when the frame time budget is being missed. */
    public boolean performanceSaver = true;
    /** Encoder worker threads; 0 picks a value from the CPU count. */
    public int encoderThreads = 0;
    /** Upper bound on pooled capture buffers, in megabytes. Also bounds the drop-free backlog. */
    public int captureMemoryBudgetMb = 48;
    /**
     * Try asynchronous pixel readback (pixel buffer objects) when the driver really supports it.
     *
     * <p>Off by default. It is a genuine saving on the render thread when it works, but it cannot
     * be tested without a device and GL4ES has been seen to advertise the extension and then not
     * honour it. Correct capture matters more than a faster capture, so this is opt-in until
     * someone has confirmed it on real hardware.
     */
    public boolean asyncReadback = false;
    /** Rolling buffer granularity. Shorter segments clip more precisely but cost more keyframes. */
    public int segmentMillis = 2000;

    // ---- interface -------------------------------------------------------------------------
    public boolean showIndicator = true;
    public Corner indicatorCorner = Corner.TOP_LEFT;
    public boolean showToasts = true;
    public boolean showStats = false;
    public boolean debugLogging = false;

    // ---- storage ---------------------------------------------------------------------------
    /** Empty means {@code <gameDir>/pcpclip/clips}. */
    public String clipDirectory = "";
    /** Empty means {@code <gameDir>/pcpclip/cache}. */
    public String cacheDirectory = "";
    public int minFreeSpaceMb = 512;
    /**
     * Optional cap on the clip folder, in gigabytes. Zero - the default - means saved clips are
     * never deleted automatically; the mod warns about space instead of throwing away footage
     * the user chose to keep.
     */
    public int maxLibraryGb = 0;
    /**
     * Audio capture. Always false: see docs/COMPATIBILITY.md - neither the game's mixer nor
     * Android's audio APIs are reachable from Pojav's game JVM without a native bridge.
     */
    public boolean audioEnabled = false;

    /** Problems found by the last {@link #validate()}, for display in the settings screen. */
    private final List<String> validationMessages = new ArrayList<String>();

    public List<String> validationMessages() {
        return new ArrayList<String>(validationMessages);
    }

    // ---- derived values --------------------------------------------------------------------

    /**
     * Output width and height for the given source framebuffer.
     *
     * @param sourceWidth  live framebuffer width, used by {@link AspectPreset#MATCH_SCREEN}
     * @param sourceHeight live framebuffer height
     */
    public int[] outputSize(int sourceWidth, int sourceHeight) {
        if (resolutionPreset == ResolutionPreset.CUSTOM) {
            return new int[]{even(clamp(customWidth, MIN_DIMENSION, MAX_DIMENSION)),
                    even(clamp(customHeight, MIN_DIMENSION, MAX_DIMENSION))};
        }
        int height = resolutionPreset.height();
        int aspectWidth;
        int aspectHeight;
        if (aspectPreset == AspectPreset.CUSTOM) {
            aspectWidth = clamp(customAspectWidth, 1, 100);
            aspectHeight = clamp(customAspectHeight, 1, 100);
        } else if (aspectPreset == AspectPreset.MATCH_SCREEN) {
            aspectWidth = sourceWidth > 0 ? sourceWidth : 16;
            aspectHeight = sourceHeight > 0 ? sourceHeight : 9;
        } else {
            aspectWidth = aspectPreset.numerator();
            aspectHeight = aspectPreset.denominator();
        }
        long width = Math.round((double) height * aspectWidth / aspectHeight);
        return new int[]{even(clamp((int) width, MIN_DIMENSION, MAX_DIMENSION)),
                even(clamp(height, MIN_DIMENSION, MAX_DIMENSION))};
    }

    public int effectiveEncoderThreads() {
        if (encoderThreads > 0) {
            return Math.min(encoderThreads, 8);
        }
        int cpus = Runtime.getRuntime().availableProcessors();
        // Leave the render thread and the OS a core to work with; phones throttle hard otherwise.
        return Math.max(1, Math.min(3, cpus - 1));
    }

    public FitMode effectiveFitMode() {
        return fitMode.resolveSupported();
    }

    // ---- validation ------------------------------------------------------------------------

    /**
     * Clamps every value into a usable range and returns the list of corrections made, so the UI
     * can show the user exactly what was rejected instead of silently misbehaving.
     */
    public List<String> validate() {
        validationMessages.clear();

        shadowBufferSeconds = clampReport(shadowBufferSeconds, MIN_BUFFER_SECONDS, MAX_BUFFER_SECONDS,
                "Buffer length");
        clipSeconds = clampReport(clipSeconds, MIN_BUFFER_SECONDS, MAX_BUFFER_SECONDS, "Clip length");
        if (clipSeconds > shadowBufferSeconds) {
            validationMessages.add("Clip length " + clipSeconds + "s is longer than the "
                    + shadowBufferSeconds + "s buffer; saved clips will be shorter.");
        }
        targetFps = clampReport(targetFps, MIN_FPS, MAX_FPS, "Frame rate");
        customWidth = clampReport(customWidth, MIN_DIMENSION, MAX_DIMENSION, "Custom width");
        customHeight = clampReport(customHeight, MIN_DIMENSION, MAX_DIMENSION, "Custom height");
        customAspectWidth = clampReport(customAspectWidth, 1, 100, "Custom aspect width");
        customAspectHeight = clampReport(customAspectHeight, 1, 100, "Custom aspect height");
        bitrateKbps = clampReport(bitrateKbps, 250, 60000, "Bitrate");
        jpegQuality = clampReport(jpegQuality, 10, 100, "JPEG quality");
        h264Qp = clampReport(h264Qp, 10, 40, "H.264 quantiser");
        encoderThreads = clampReport(encoderThreads, 0, 8, "Encoder threads");
        captureMemoryBudgetMb = clampReport(captureMemoryBudgetMb, 12, 512, "Capture memory budget");
        segmentMillis = clampReport(segmentMillis, 500, 10000, "Segment length");
        minFreeSpaceMb = clampReport(minFreeSpaceMb, 64, 20000, "Minimum free space");
        maxLibraryGb = clampReport(maxLibraryGb, 0, 512, "Clip folder cap");

        if (!fitMode.isSupported()) {
            validationMessages.add(fitMode.label() + " is not available on this renderer; using "
                    + fitMode.resolveSupported().label() + ".");
        }
        if (audioEnabled) {
            audioEnabled = false;
            validationMessages.add("Audio capture is not available in this environment.");
        }
        return validationMessages();
    }

    private int clampReport(int value, int min, int max, String what) {
        int clamped = clamp(value, min, max);
        if (clamped != value) {
            validationMessages.add(what + " " + value + " is out of range (" + min + "-" + max
                    + "); using " + clamped + ".");
        }
        return clamped;
    }

    private static int clamp(int value, int min, int max) {
        return value < min ? min : (value > max ? max : value);
    }

    private static int even(int value) {
        return (value & 1) == 0 ? value : value - 1;
    }

    // ---- persistence -----------------------------------------------------------------------

    public ClipConfig copy() {
        ClipConfig other = new ClipConfig();
        other.modEnabled = modEnabled;
        other.shadowBuffer = shadowBuffer;
        other.shadowBufferSeconds = shadowBufferSeconds;
        other.clipSeconds = clipSeconds;
        other.resolutionPreset = resolutionPreset;
        other.aspectPreset = aspectPreset;
        other.customWidth = customWidth;
        other.customHeight = customHeight;
        other.customAspectWidth = customAspectWidth;
        other.customAspectHeight = customAspectHeight;
        other.targetFps = targetFps;
        other.fitMode = fitMode;
        other.encoder = encoder;
        other.bitrateKbps = bitrateKbps;
        other.jpegQuality = jpegQuality;
        other.h264Qp = h264Qp;
        other.fixedFrameRateExport = fixedFrameRateExport;
        other.performanceSaver = performanceSaver;
        other.encoderThreads = encoderThreads;
        other.captureMemoryBudgetMb = captureMemoryBudgetMb;
        other.asyncReadback = asyncReadback;
        other.segmentMillis = segmentMillis;
        other.showIndicator = showIndicator;
        other.indicatorCorner = indicatorCorner;
        other.showToasts = showToasts;
        other.showStats = showStats;
        other.debugLogging = debugLogging;
        other.clipDirectory = clipDirectory;
        other.cacheDirectory = cacheDirectory;
        other.minFreeSpaceMb = minFreeSpaceMb;
        other.maxLibraryGb = maxLibraryGb;
        other.audioEnabled = audioEnabled;
        return other;
    }

    public static ClipConfig load(File file) {
        ClipConfig config = new ClipConfig();
        if (file == null || !file.isFile()) {
            return config;
        }
        Properties properties = new Properties();
        Reader reader = null;
        try {
            reader = new InputStreamReader(new FileInputStream(file), "UTF-8");
            properties.load(reader);
        } catch (IOException error) {
            PcpLog.warn("Could not read " + file + "; falling back to defaults", error);
            return config;
        } finally {
            close(reader);
        }
        config.readFrom(properties);
        config.validate();
        return config;
    }

    private void readFrom(Properties p) {
        modEnabled = bool(p, "general.enabled", modEnabled);
        debugLogging = bool(p, "general.debugLogging", debugLogging);
        shadowBuffer = bool(p, "buffer.enabled", shadowBuffer);
        shadowBufferSeconds = integer(p, "buffer.seconds", shadowBufferSeconds);
        clipSeconds = integer(p, "buffer.clipSeconds", clipSeconds);

        resolutionPreset = ResolutionPreset.byName(p.getProperty("video.resolution"), resolutionPreset);
        aspectPreset = AspectPreset.byName(p.getProperty("video.aspect"), aspectPreset);
        customWidth = integer(p, "video.customWidth", customWidth);
        customHeight = integer(p, "video.customHeight", customHeight);
        customAspectWidth = integer(p, "video.customAspectWidth", customAspectWidth);
        customAspectHeight = integer(p, "video.customAspectHeight", customAspectHeight);
        targetFps = integer(p, "video.fps", targetFps);
        fitMode = FitMode.byName(p.getProperty("video.fitMode"), fitMode);
        encoder = EncoderPreference.byName(p.getProperty("video.encoder"), encoder);
        bitrateKbps = integer(p, "video.bitrateKbps", bitrateKbps);
        jpegQuality = integer(p, "video.jpegQuality", jpegQuality);
        h264Qp = integer(p, "video.h264Qp", h264Qp);
        fixedFrameRateExport = bool(p, "video.fixedFrameRateExport", fixedFrameRateExport);

        performanceSaver = bool(p, "performance.saver", performanceSaver);
        encoderThreads = integer(p, "performance.encoderThreads", encoderThreads);
        captureMemoryBudgetMb = integer(p, "performance.captureMemoryBudgetMb", captureMemoryBudgetMb);
        asyncReadback = bool(p, "performance.asyncReadback", asyncReadback);
        segmentMillis = integer(p, "performance.segmentMillis", segmentMillis);

        showIndicator = bool(p, "hud.showIndicator", showIndicator);
        indicatorCorner = Corner.byName(p.getProperty("hud.indicatorCorner"), indicatorCorner);
        showToasts = bool(p, "hud.showToasts", showToasts);
        showStats = bool(p, "hud.showStats", showStats);

        clipDirectory = p.getProperty("storage.clipDirectory", clipDirectory);
        cacheDirectory = p.getProperty("storage.cacheDirectory", cacheDirectory);
        minFreeSpaceMb = integer(p, "storage.minFreeSpaceMb", minFreeSpaceMb);
        maxLibraryGb = integer(p, "storage.maxLibraryGb", maxLibraryGb);
        audioEnabled = bool(p, "audio.enabled", audioEnabled);
    }

    public boolean save(File file) {
        if (file == null) {
            return false;
        }
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            PcpLog.warn("Could not create config folder " + parent);
            return false;
        }
        PrintWriter out = null;
        try {
            out = new PrintWriter(new OutputStreamWriter(new FileOutputStream(file), "UTF-8"));
            out.println("# PcpClip configuration (file version " + FILE_VERSION + ")");
            out.println("# Hotkeys live in Minecraft's own Controls screen, not here.");
            out.println();
            out.println("general.enabled=" + modEnabled);
            out.println("general.debugLogging=" + debugLogging);
            out.println();
            out.println("# Rolling instant-replay buffer. Costs nothing while disabled.");
            out.println("buffer.enabled=" + shadowBuffer);
            out.println("buffer.seconds=" + shadowBufferSeconds);
            out.println("buffer.clipSeconds=" + clipSeconds);
            out.println();
            out.println("# resolution: " + names(ResolutionPreset.values()));
            out.println("video.resolution=" + resolutionPreset.name());
            out.println("# aspect: " + names(AspectPreset.values()));
            out.println("video.aspect=" + aspectPreset.name());
            out.println("video.customWidth=" + customWidth);
            out.println("video.customHeight=" + customHeight);
            out.println("video.customAspectWidth=" + customAspectWidth);
            out.println("video.customAspectHeight=" + customAspectHeight);
            out.println("video.fps=" + targetFps);
            out.println("# fitMode: " + names(FitMode.values()));
            out.println("video.fitMode=" + fitMode.name());
            out.println("# encoder: " + names(EncoderPreference.values()));
            out.println("video.encoder=" + encoder.name());
            out.println("video.bitrateKbps=" + bitrateKbps);
            out.println("video.jpegQuality=" + jpegQuality);
            out.println("video.h264Qp=" + h264Qp);
            out.println("video.fixedFrameRateExport=" + fixedFrameRateExport);
            out.println();
            out.println("performance.saver=" + performanceSaver);
            out.println("performance.encoderThreads=" + encoderThreads + " # 0 = automatic");
            out.println("performance.captureMemoryBudgetMb=" + captureMemoryBudgetMb);
            out.println("# Experimental: faster, but unverified on Android GL drivers.");
            out.println("performance.asyncReadback=" + asyncReadback);
            out.println("performance.segmentMillis=" + segmentMillis);
            out.println();
            out.println("hud.showIndicator=" + showIndicator);
            out.println("hud.indicatorCorner=" + indicatorCorner.name());
            out.println("hud.showToasts=" + showToasts);
            out.println("hud.showStats=" + showStats);
            out.println();
            out.println("# Empty paths mean <gameDir>/pcpclip/clips and <gameDir>/pcpclip/cache.");
            out.println("storage.clipDirectory=" + clipDirectory);
            out.println("storage.cacheDirectory=" + cacheDirectory);
            out.println("storage.minFreeSpaceMb=" + minFreeSpaceMb);
            out.println("# 0 means saved clips are never deleted automatically.");
            out.println("storage.maxLibraryGb=" + maxLibraryGb);
            out.println();
            out.println("# Audio capture is not available in this environment; see docs.");
            out.println("audio.enabled=" + audioEnabled);
            out.flush();
            return !out.checkError();
        } catch (IOException error) {
            PcpLog.error("Could not write " + file, error);
            return false;
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }

    private static String names(Object[] values) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) {
                builder.append(", ");
            }
            builder.append(((Enum<?>) values[i]).name());
        }
        return builder.toString();
    }

    /** Properties written with a trailing {@code # comment} are tolerated on read. */
    private static int integer(Properties p, String key, int fallback) {
        String raw = p.getProperty(key);
        if (raw == null) {
            return fallback;
        }
        int hash = raw.indexOf('#');
        if (hash >= 0) {
            raw = raw.substring(0, hash);
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ignored) {
            PcpLog.warn("Ignoring unreadable value for " + key + ": '" + raw.trim() + "'");
            return fallback;
        }
    }

    private static boolean bool(Properties p, String key, boolean fallback) {
        String raw = p.getProperty(key);
        if (raw == null) {
            return fallback;
        }
        raw = raw.trim();
        if ("true".equalsIgnoreCase(raw) || "false".equalsIgnoreCase(raw)) {
            return Boolean.parseBoolean(raw);
        }
        PcpLog.warn("Ignoring unreadable value for " + key + ": '" + raw + "'");
        return fallback;
    }

    private static void close(Reader reader) {
        if (reader != null) {
            try {
                reader.close();
            } catch (IOException ignored) {
                // nothing useful to do while closing a config file
            }
        }
    }
}
