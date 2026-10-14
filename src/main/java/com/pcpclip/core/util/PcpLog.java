package com.pcpclip.core.util;

/**
 * Minimal logging facade.
 *
 * <p>The core is deliberately free of Minecraft and Forge types so it can be unit tested and
 * benchmarked on a bare JVM; this keeps logging out of the way of that goal. The Minecraft layer
 * installs a {@link Sink} that forwards to Forge's logger.
 */
public final class PcpLog {

    /** Destination for log records. */
    public interface Sink {
        void log(String level, String message, Throwable error);
    }

    private static volatile Sink sink = new Sink() {
        @Override
        public void log(String level, String message, Throwable error) {
            System.out.println("[PcpClip/" + level + "] " + message);
            if (error != null) {
                error.printStackTrace(System.out);
            }
        }
    };

    private static volatile boolean debug = false;

    private PcpLog() {
    }

    public static void setSink(Sink newSink) {
        sink = newSink != null ? newSink : sink;
    }

    public static void setDebug(boolean enabled) {
        debug = enabled;
    }

    public static boolean isDebug() {
        return debug;
    }

    public static void info(String message) {
        sink.log("INFO", message, null);
    }

    public static void warn(String message) {
        sink.log("WARN", message, null);
    }

    public static void warn(String message, Throwable error) {
        sink.log("WARN", message, error);
    }

    public static void error(String message, Throwable error) {
        sink.log("ERROR", message, error);
    }

    /** Debug records are suppressed unless debugging is on, so hot paths stay allocation free. */
    public static void debug(String message) {
        if (debug) {
            sink.log("DEBUG", message, null);
        }
    }
}
