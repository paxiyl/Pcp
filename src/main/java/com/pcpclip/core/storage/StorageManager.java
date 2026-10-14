package com.pcpclip.core.storage;

import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.util.Fmt;
import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Where clips and cached segments live, how much room is left, and how much a clip will cost.
 *
 * <p>Paths default to {@code <gameDir>/pcpclip/...} because that folder is reachable from an
 * Android file manager in every PojavLauncher layout, and because nothing outside the game
 * directory can be assumed writable without storage permissions.
 */
public final class StorageManager {

    /**
     * Bytes per pixel for a quality-55 JPEG of real gameplay, measured from clips captured on a
     * device: a plain outdoor scene came out at 0.051 and a dense build at 0.119 bytes per pixel.
     * The midpoint is used, because a storage estimate that is cheerful is worse than one that is
     * slightly pessimistic - a clip that does not fit is a clip that is lost.
     */
    private static final double MJPEG_BYTES_PER_PIXEL_AT_Q55 = 0.085;

    private final File gameDirectory;
    private volatile ClipConfig config;

    public StorageManager(File gameDirectory, ClipConfig config) {
        this.gameDirectory = gameDirectory;
        this.config = config;
    }

    public void setConfig(ClipConfig config) {
        this.config = config;
    }

    public File baseDirectory() {
        return new File(gameDirectory, "pcpclip");
    }

    public File clipDirectory() {
        String configured = config.clipDirectory;
        File directory = configured != null && !configured.trim().isEmpty()
                ? new File(configured.trim())
                : new File(baseDirectory(), "clips");
        ensure(directory);
        return directory;
    }

    /** Segment cache. Separate from clips so a user clearing clips never breaks a live buffer. */
    public File cacheDirectory() {
        String configured = config.cacheDirectory;
        File directory = configured != null && !configured.trim().isEmpty()
                ? new File(configured.trim())
                : new File(baseDirectory(), "cache");
        ensure(directory);
        return directory;
    }

    private void ensure(File directory) {
        if (!directory.isDirectory() && !directory.mkdirs()) {
            PcpLog.warn("Could not create " + directory + "; clips cannot be saved there");
        }
    }

    public long freeSpaceBytes() {
        try {
            File probe = clipDirectory();
            long usable = probe.getUsableSpace();
            return usable > 0L ? usable : probe.getFreeSpace();
        } catch (SecurityException denied) {
            PcpLog.debug("free space query denied: " + denied.getMessage());
            return -1L;
        }
    }

    public boolean writable() {
        File directory = clipDirectory();
        return directory.isDirectory() && directory.canWrite();
    }

    /** True when there is less room than the configured floor. */
    public boolean lowOnSpace() {
        long free = freeSpaceBytes();
        return free >= 0L && free < (long) config.minFreeSpaceMb * 1024L * 1024L;
    }

    /** True when a clip of this size would not fit while keeping the configured reserve. */
    public boolean wouldOverfill(long bytes) {
        long free = freeSpaceBytes();
        if (free < 0L) {
            return false;                               // unknown; let the write try and fail
        }
        return free - bytes < (long) config.minFreeSpaceMb * 1024L * 1024L;
    }

    /**
     * Estimated size of a clip.
     *
     * @param measuredBytesPerFrame bytes per frame observed by the live pipeline, or 0 when
     *                              nothing has been encoded yet and the model has to guess
     */
    public long estimateClipBytes(int seconds, int width, int height, int fps,
                                  SegmentCodec codec, long measuredBytesPerFrame) {
        long frames = (long) Math.max(1, seconds) * Math.max(1, fps);
        if (measuredBytesPerFrame > 0L) {
            return frames * measuredBytesPerFrame;
        }
        if (codec == SegmentCodec.MJPEG) {
            double scale = Math.max(0.2, config.jpegQuality / 55.0);
            double perFrame = (double) width * height * MJPEG_BYTES_PER_PIXEL_AT_Q55 * scale;
            return (long) (frames * perFrame);
        }
        return (long) config.bitrateKbps * 1000L / 8L * Math.max(1, seconds);
    }

    public String describeFreeSpace() {
        long free = freeSpaceBytes();
        return free < 0L ? "unknown" : Fmt.bytes(free) + " free";
    }

    /**
     * Builds a unique clip file name: sortable timestamp first, then the world or server, so the
     * folder stays browsable without any index.
     */
    public File newClipFile(String container, String worldName) {
        String stamp = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
        String label = sanitise(worldName);
        String base = label.isEmpty() ? "pcpclip-" + stamp : "pcpclip-" + stamp + "-" + label;
        File directory = clipDirectory();
        File candidate = new File(directory, base + "." + container);
        int suffix = 2;
        while (candidate.exists()) {
            candidate = new File(directory, base + "-" + suffix + "." + container);
            suffix++;
        }
        return candidate;
    }

    /** Keeps file names safe for FAT32 and exFAT, which is what most Android storage uses. */
    public static String sanitise(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < raw.length() && builder.length() < 32; i++) {
            char c = raw.charAt(i);
            if (Character.isLetterOrDigit(c)) {
                builder.append(c);
            } else if ((c == '-' || c == '_' || c == '.' || c == ' ') && builder.length() > 0) {
                builder.append(c == ' ' ? '_' : c);
            }
        }
        while (builder.length() > 0 && builder.charAt(builder.length() - 1) == '.') {
            builder.setLength(builder.length() - 1);
        }
        return builder.toString();
    }

    /** Suffix used while a clip is being written, so half-written files never look finished. */
    public static final String PARTIAL_SUFFIX = ".part";

    /** Temporary name to write a clip to before publishing it under its real name. */
    public File partialFor(File clip) {
        return new File(clip.getParentFile(), clip.getName() + PARTIAL_SUFFIX);
    }

    /**
     * Publishes a finished clip by renaming it into place.
     *
     * <p>A clip only becomes visible to the clip list once it is complete, so an export that is
     * interrupted by a crash or a dead battery leaves a {@code .part} file that is cleaned up on
     * the next launch instead of a corrupt video that looks playable.
     *
     * @return the published file, or the partial file when the rename was refused
     */
    public File publish(File partial, File finished) {
        if (partial.renameTo(finished)) {
            return finished;
        }
        PcpLog.warn("Could not rename " + partial.getName() + " to " + finished.getName()
                + "; leaving the clip under its temporary name");
        return partial;
    }

    /** Removes partial clips left behind by an interrupted export. Called once at startup. */
    public int removeStalePartials() {
        File[] files = clipDirectory().listFiles();
        if (files == null) {
            return 0;
        }
        int removed = 0;
        for (File file : files) {
            if (file.isFile() && file.getName().endsWith(PARTIAL_SUFFIX) && file.delete()) {
                removed++;
            }
        }
        if (removed > 0) {
            PcpLog.info("removed " + removed + " unfinished clip file(s) from a previous session");
        }
        return removed;
    }

    /** Deletes leftover segment files. Called when the buffer is switched off. */
    public void clearCache() {
        File cache = cacheDirectory();
        File[] files = cache.listFiles();
        if (files == null) {
            return;
        }
        int removed = 0;
        for (File file : files) {
            if (file.isFile() && file.delete()) {
                removed++;
            }
        }
        if (removed > 0) {
            PcpLog.info("cleared " + removed + " cached segment file(s)");
        }
    }
}
