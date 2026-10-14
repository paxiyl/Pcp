package com.pcpclip.core.perf;

import com.pcpclip.core.pipeline.PipelineStats;
import com.pcpclip.core.util.PcpLog;

/**
 * Watches how much the game is struggling and decides how hard to push the capture.
 *
 * <p>Two signals matter. Frame time, sampled on the render thread, says whether the game itself is
 * suffering; the encoder drop rate says whether the pipeline is keeping up. When either is bad the
 * monitor steps capture down - first the capture rate, then the encoder quality - and steps back
 * up once things settle, with hysteresis so it cannot oscillate once a second.
 *
 * <p>Only the render thread writes frame times, so the exponential averages need no locking.
 */
public final class LoadMonitor {

    /** How many steps of degradation exist; each one halves the capture rate or lowers quality. */
    public static final int MAX_LEVEL = 3;

    private static final double SMOOTHING = 0.1;
    private static final long DECISION_INTERVAL_NANOS = 2_000_000_000L;
    private static final long RECOVERY_INTERVAL_NANOS = 10_000_000_000L;

    private final boolean enabled;
    /** Frame time above which the game is considered to be suffering. */
    private final double budgetMillis;

    private double averageFrameMillis;
    private double worstRecentFrameMillis;
    private long lastDecisionNanos;
    private long lastDegradeNanos;
    private int level;
    private String reason = "";

    /**
     * @param enabled      whether automatic stepping down is allowed at all
     * @param budgetMillis frame time budget; 0 derives one from the game's own frame rate
     */
    public LoadMonitor(boolean enabled, double budgetMillis) {
        this.enabled = enabled;
        this.budgetMillis = budgetMillis > 0.0 ? budgetMillis : 0.0;
    }

    /** Called once per rendered frame on the render thread. */
    public void recordFrameTime(long frameNanos) {
        double millis = frameNanos / 1_000_000.0;
        if (millis <= 0.0 || millis > 2000.0) {
            return;                                  // a loading pause is not a performance signal
        }
        if (averageFrameMillis == 0.0) {
            averageFrameMillis = millis;
        } else {
            averageFrameMillis += (millis - averageFrameMillis) * SMOOTHING;
        }
        if (millis > worstRecentFrameMillis) {
            worstRecentFrameMillis = millis;
        }
    }

    /**
     * Reconsiders the degradation level.
     *
     * @param dropRate       fraction of capture attempts that could not be buffered
     * @param baselineMillis frame time measured while not recording, or 0 if unknown
     * @return true when the level changed
     */
    public boolean reconsider(double dropRate, double baselineMillis) {
        if (!enabled) {
            return false;
        }
        long now = System.nanoTime();
        if (now - lastDecisionNanos < DECISION_INTERVAL_NANOS) {
            return false;
        }
        lastDecisionNanos = now;

        double budget = budgetMillis;
        if (budget <= 0.0) {
            // Allow a tenth more frame time than the game managed without recording, with a floor
            // so a device already running at 10 fps is not held to an impossible target.
            budget = baselineMillis > 0.0 ? Math.max(baselineMillis * 1.1, 8.0) : 33.0;
        }

        int previous = level;
        boolean frameTimeBad = averageFrameMillis > budget;
        boolean droppingBadly = dropRate > 0.2;

        if ((frameTimeBad || droppingBadly) && level < MAX_LEVEL) {
            level++;
            lastDegradeNanos = now;
            reason = frameTimeBad
                    ? "frame time " + round(averageFrameMillis) + "ms over budget " + round(budget) + "ms"
                    : "dropping " + Math.round(dropRate * 100) + "% of captures";
            PcpLog.info("performance saver: stepping capture down to level " + level + " (" + reason + ")");
        } else if (!frameTimeBad && !droppingBadly && level > 0
                && now - lastDegradeNanos > RECOVERY_INTERVAL_NANOS) {
            level--;
            lastDegradeNanos = now;
            reason = "recovered";
            PcpLog.info("performance saver: stepping capture back up to level " + level);
        }
        worstRecentFrameMillis = 0.0;
        return level != previous;
    }

    public int level() {
        return level;
    }

    public String reason() {
        return reason;
    }

    public double averageFrameMillis() {
        return averageFrameMillis;
    }

    public boolean enabled() {
        return enabled;
    }

    /** Capture rate to actually use, given the configured target. */
    public int effectiveFps(int targetFps) {
        switch (level) {
            case 1:
                return Math.max(10, (int) Math.round(targetFps * 0.66));
            case 2:
                return Math.max(10, targetFps / 2);
            case 3:
                return Math.max(8, targetFps / 4);
            default:
                return targetFps;
        }
    }

    /** JPEG quality to use for the next segment, given the configured value. */
    public int effectiveJpegQuality(int configured) {
        return Math.max(20, configured - level * 8);
    }

    /** H.264 quantiser for the next segment; higher means cheaper and blurrier. */
    public int effectiveH264Qp(int configured) {
        return Math.min(40, configured + level * 3);
    }

    /**
     * The highest capture rate the encoders can actually absorb, from their measured cost.
     *
     * <p>This is the cheapest optimisation available on a phone: reading a frame out of the GPU
     * costs the render thread several milliseconds and several megabytes of bus traffic, and
     * doing that for a frame the encoder will immediately drop is pure waste. Asking for 120 fps
     * when the encoder can manage 30 does not produce a smoother clip - it produces the same clip
     * and a worse frame rate in game.
     *
     * <p>Returns {@code targetFps} until enough frames have been encoded to trust the average, and
     * never clamps below 5 fps, so a brief stall cannot strand the capture at zero.
     *
     * @param encodeMillis  mean encode cost per frame, from {@link PipelineStats}
     * @param workers       encoder worker threads
     * @param encodedFrames how many frames that average is based on
     */
    public static int sustainableFps(int targetFps, double encodeMillis, int workers,
                                     long encodedFrames) {
        if (encodedFrames < 20L || encodeMillis <= 0.5) {
            return targetFps;
        }
        double perThread = 1000.0 / encodeMillis;
        // Leave some headroom: running the encoders at exactly 100% means any hiccup drops frames.
        int sustainable = (int) Math.floor(perThread * Math.max(1, workers) * 0.85);
        return Math.max(5, Math.min(targetFps, sustainable));
    }

    public void reset() {
        level = 0;
        reason = "";
        averageFrameMillis = 0.0;
        worstRecentFrameMillis = 0.0;
    }

    private static String round(double value) {
        return Long.toString(Math.round(value));
    }
}
