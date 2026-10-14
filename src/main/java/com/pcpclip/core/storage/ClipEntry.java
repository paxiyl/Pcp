package com.pcpclip.core.storage;

import com.pcpclip.core.util.Fmt;

import java.io.File;
import java.util.Locale;

/** One saved clip, plus whatever the sidecar file records about how it was captured. */
public final class ClipEntry {

    public final File file;
    public final long sizeBytes;
    public final long savedAtMillis;

    public final int width;
    public final int height;
    public final int frames;
    public final double durationSeconds;
    public final double measuredFps;
    public final int targetFps;
    public final String codec;
    public final String note;

    public ClipEntry(File file, long sizeBytes, long savedAtMillis, int width, int height,
                     int frames, double durationSeconds, double measuredFps, int targetFps,
                     String codec, String note) {
        this.file = file;
        this.sizeBytes = sizeBytes;
        this.savedAtMillis = savedAtMillis;
        this.width = width;
        this.height = height;
        this.frames = frames;
        this.durationSeconds = durationSeconds;
        this.measuredFps = measuredFps;
        this.targetFps = targetFps;
        this.codec = codec;
        this.note = note == null ? "" : note;
    }

    public String name() {
        return file.getName();
    }

    /** One line for the clip list: size, length and the frame rate actually captured. */
    public String summary() {
        StringBuilder builder = new StringBuilder();
        builder.append(Fmt.bytes(sizeBytes));
        if (durationSeconds > 0.0) {
            builder.append("  ").append(Fmt.duration((long) (durationSeconds * 1000.0)));
        }
        if (width > 0) {
            builder.append("  ").append(Fmt.dimensions(width, height));
        }
        if (measuredFps > 0.0) {
            builder.append("  ").append(String.format(Locale.ROOT, "%.0f fps", measuredFps));
            if (targetFps > 0 && measuredFps < targetFps * 0.9) {
                builder.append(" (asked ").append(targetFps).append(")");
            }
        }
        return builder.toString();
    }
}
