package dev.paxiyl.pcp.core;

/**
 * Learns the effective attack range on this server by watching where hits
 * actually land.
 *
 * <p>This exists because {@code effectiveRange} was the single hardest setting
 * to tune by hand and the one that skews every other decision: it anchors the
 * combo band, the danger band, the trade window and the knockback-gap test, and
 * there is no way for a player to read it off the screen. But it does not need
 * to be guessed - it is directly measurable. Every confirmed hit tells us the
 * gap a hit landed from; the far end of that distribution <em>is</em> the
 * practical reach, whatever the server's software and lag compensation have
 * made it.</p>
 *
 * <p>The estimate is the 90th percentile of recent confirmed-hit gaps rather
 * than the maximum, so one mismeasured sample cannot stretch it. It is
 * deliberately conservative: a player who never reaches for a long hit gets a
 * slightly short estimate, which errs towards holding spacing rather than
 * lunging. Whiffs are counted for diagnostics but not used to set the number,
 * because a whiff is far more often bad aim than excess range.</p>
 */
public final class ReachEstimator {

    /** Hits needed before the estimate is offered at all. */
    private static final int MIN_HITS = 8;
    private static final int WINDOW = 40;
    private static final int CONFIDENCE_SATURATION = 10;
    /** Samples needed before the second-highest is preferred to the highest. */
    private static final int ROBUST_MAX_MIN_SAMPLES = 10;
    /** Plausible bounds; outside these something else is going on. */
    private static final double MIN_PLAUSIBLE = 2.0D;
    private static final double MAX_PLAUSIBLE = 4.5D;

    private final RollingStats hitGaps = new RollingStats(WINDOW, 0.15D);
    private int whiffs;

    /** @param gap the gap, in blocks, at the moment the attack was sent */
    public void recordHit(double gap) {
        if (gap <= 0.0D || gap > 8.0D) {
            return;
        }
        this.hitGaps.push(gap);
    }

    /** An attack that produced no visible reaction. Diagnostics only. */
    public void recordWhiff(double gap) {
        this.whiffs++;
    }

    public boolean hasEstimate() {
        return this.hitGaps.count() >= MIN_HITS;
    }

    /**
     * Learned effective range in blocks, or -1 when there is not enough
     * evidence yet. Clamped to the same plausible band as the manual setting.
     *
     * <p>Reach is a <em>boundary</em>, not a central tendency, so this takes a
     * robust maximum of the observed hit gaps rather than a percentile of the
     * bulk. A percentile answers "how far out do hits usually land", which sits
     * well short of the limit because players rarely swing at maximum range -
     * measured against the simulation, the 90th percentile read 0.2 to 0.35
     * blocks low against a known reach of 3.0. The second-highest sample
     * answers the right question while still discarding one mismeasurement.</p>
     */
    public double estimate() {
        if (!hasEstimate()) {
            return -1.0D;
        }
        return RollingStats.clamp(robustMax(), MIN_PLAUSIBLE, MAX_PLAUSIBLE);
    }

    /**
     * The highest observed hit gap, less the single most extreme sample once
     * there are enough of them to afford dropping one.
     */
    private double robustMax() {
        int n = this.hitGaps.count();
        if (n >= ROBUST_MAX_MIN_SAMPLES) {
            // Second highest: one stray long measurement cannot set the range.
            return this.hitGaps.percentile((double) (n - 2) / (double) (n - 1));
        }
        return this.hitGaps.max();
    }

    public double confidence() {
        return RollingStats.confidenceFrom(this.hitGaps.count(), this.hitGaps.robustCv(),
                CONFIDENCE_SATURATION);
    }

    public int hitSamples() {
        return this.hitGaps.count();
    }

    public int whiffs() {
        return this.whiffs;
    }

    /** Typical gap hits land from, as opposed to the far end of the range. */
    public double medianHitGap() {
        return this.hitGaps.median();
    }

    public void reset() {
        this.hitGaps.clear();
        this.whiffs = 0;
    }

    /** Serialises the sample window for per-server persistence. */
    public String toCsv() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < this.hitGaps.count(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(String.format("%.3f", this.hitGaps.get(i)));
        }
        return sb.toString();
    }

    public void fromCsv(String raw) {
        if (raw == null || raw.isEmpty()) {
            return;
        }
        String[] parts = raw.split(",");
        for (int i = 0; i < parts.length; i++) {
            try {
                recordHit(Double.parseDouble(parts[i].trim()));
            } catch (NumberFormatException ignored) {
                // One unreadable entry just means one fewer sample.
            }
        }
    }

    public String describe() {
        if (!hasEstimate()) {
            return String.format("learning (%d/%d hits)", this.hitGaps.count(), MIN_HITS);
        }
        return String.format("%.2f msr n=%d conf%.0f%%",
                estimate(), this.hitGaps.count(), confidence() * 100.0D);
    }
}
