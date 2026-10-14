package com.pcpclip.core.util;

import java.util.Locale;

/** Human readable formatting for sizes, durations and rates shown in the GUI and logs. */
public final class Fmt {

    private Fmt() {
    }

    public static String bytes(long value) {
        if (value < 1024L) {
            return value + " B";
        }
        if (value < 1024L * 1024L) {
            return String.format(Locale.ROOT, "%.1f KB", value / 1024.0);
        }
        if (value < 1024L * 1024L * 1024L) {
            return String.format(Locale.ROOT, "%.1f MB", value / (1024.0 * 1024.0));
        }
        return String.format(Locale.ROOT, "%.2f GB", value / (1024.0 * 1024.0 * 1024.0));
    }

    public static String bitrate(long bitsPerSecond) {
        if (bitsPerSecond < 1000L) {
            return bitsPerSecond + " bps";
        }
        if (bitsPerSecond < 1000000L) {
            return String.format(Locale.ROOT, "%.0f kbps", bitsPerSecond / 1000.0);
        }
        return String.format(Locale.ROOT, "%.1f Mbps", bitsPerSecond / 1000000.0);
    }

    /** Formats a duration as m:ss, or h:mm:ss once it passes an hour. */
    public static String duration(long millis) {
        long totalSeconds = Math.max(0L, millis) / 1000L;
        long hours = totalSeconds / 3600L;
        long minutes = (totalSeconds % 3600L) / 60L;
        long seconds = totalSeconds % 60L;
        if (hours > 0L) {
            return String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds);
        }
        return String.format(Locale.ROOT, "%d:%02d", minutes, seconds);
    }

    public static String millis(double value) {
        return String.format(Locale.ROOT, "%.2f ms", value);
    }

    public static String oneDecimal(double value) {
        return String.format(Locale.ROOT, "%.1f", value);
    }

    public static String dimensions(int width, int height) {
        return width + "x" + height;
    }
}
