package dev.paxiyl.pcp.core;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Rolling, per-server estimate of how knockback actually behaves here.
 *
 * <p><b>What this is.</b> An approximation built from observed displacement
 * after hits. Servers commonly change knockback through plugins, and the client
 * is never told the values, so this class never claims to know them: it reports
 * a blended estimate plus a confidence number, and callers are expected to back
 * off while confidence is low.</p>
 *
 * <p><b>Priors.</b> Before anything is measured the profile reports vanilla
 * 1.8.9-like reference values. Those are a starting point, not a measurement;
 * {@link #confidence(boolean)} returns ~0 until real samples arrive, and
 * {@link #isMeasured(boolean)} stays false. As samples accumulate the reported
 * value slides from the prior towards the measured mean in proportion to
 * confidence.</p>
 */
public final class KnockbackProfile {

    /**
     * Reference values that approximate unmodified 1.8.9 behaviour, used only
     * as a low-confidence prior. Derived from the vanilla knockback impulse
     * (~0.4 horizontal, +0.5 extra for a sprint hit, 0.4 vertical cap) after
     * air drag, expressed as total travelled distance rather than velocity.
     */
    public static final double PRIOR_WALK_HORIZONTAL = 1.05D;
    public static final double PRIOR_SPRINT_HORIZONTAL = 1.95D;
    public static final double PRIOR_WALK_VERTICAL = 0.36D;
    public static final double PRIOR_SPRINT_VERTICAL = 0.38D;
    public static final double PRIOR_WALK_SEPARATION = 0.85D;
    public static final double PRIOR_SPRINT_SEPARATION = 1.70D;

    private static final int WINDOW = 24;
    private static final int CONFIDENCE_SATURATION = 6;
    /** Consecutive wild samples before we assume the rules changed under us. */
    private static final int REGIME_CHANGE_STRIKES = 4;
    private static final double REGIME_CHANGE_Z = 3.0D;

    private final RollingStats walkHorizontal = new RollingStats(WINDOW, 0.25D);
    private final RollingStats sprintHorizontal = new RollingStats(WINDOW, 0.25D);
    private final RollingStats walkVertical = new RollingStats(WINDOW, 0.25D);
    private final RollingStats sprintVertical = new RollingStats(WINDOW, 0.25D);
    private final RollingStats walkSeparation = new RollingStats(WINDOW, 0.25D);
    private final RollingStats sprintSeparation = new RollingStats(WINDOW, 0.25D);
    /** Knockback we take, which is what the recovery state has to plan around. */
    private final RollingStats incomingSeparation = new RollingStats(WINDOW, 0.25D);
    /** Observed ticks between our attack and the victim reacting. */
    private final RollingStats reaction = new RollingStats(WINDOW, 0.3D);

    private double learningRate = 0.25D;
    private int regimeStrikes;
    /**
     * Baseline frozen when a run of odd samples starts. Comparing later samples
     * against the distribution as it was before the run matters: once a few
     * outliers are in the window they inflate its spread and hide themselves.
     */
    private boolean baselineFrozen;
    private double baselineMean;
    private double baselineTolerance;
    private long lastRegimeChangeAt = -1L;
    private int totalObservations;
    private String serverKey = "unknown";

    public void setServerKey(String serverKey) {
        this.serverKey = serverKey == null ? "unknown" : serverKey;
    }

    public String serverKey() {
        return this.serverKey;
    }

    /**
     * @param learningRate 0.05 (slow, steady) .. 1.0 (react to the last few hits)
     */
    public void setLearningRate(double learningRate) {
        this.learningRate = RollingStats.clamp(learningRate, 0.05D, 1.0D);
    }

    public void record(KnockbackObservation obs) {
        if (obs == null) {
            return;
        }
        if (!obs.outgoing) {
            this.incomingSeparation.push(obs.separationGain);
            this.totalObservations++;
            return;
        }

        RollingStats h = obs.sprintHit ? this.sprintHorizontal : this.walkHorizontal;
        RollingStats v = obs.sprintHit ? this.sprintVertical : this.walkVertical;
        RollingStats s = obs.sprintHit ? this.sprintSeparation : this.walkSeparation;

        // Watch for a *run* of samples that do not belong to the distribution we
        // have been building: a server switch, a new arena with different
        // plugins, or a knockback change mid-session. A single odd sample is
        // expected - a hit landed while falling, or one we mis-attributed - so
        // only a sustained run counts, and a sample back near the baseline
        // cancels the run.
        trackRegime(h, obs.horizontalDisplacement);

        h.push(obs.horizontalDisplacement);
        v.push(obs.verticalMotion);
        s.push(obs.separationGain);
        if (obs.reactionTicks > 0) {
            this.reaction.push(obs.reactionTicks);
        }
        this.totalObservations++;
    }

    /** Horizontal push estimate in blocks, prior-blended. */
    public double horizontalPush(boolean sprintHit) {
        RollingStats st = sprintHit ? this.sprintHorizontal : this.walkHorizontal;
        double prior = sprintHit ? PRIOR_SPRINT_HORIZONTAL : PRIOR_WALK_HORIZONTAL;
        return blend(st, prior);
    }

    /** Vertical pop estimate in blocks/tick, prior-blended. */
    public double verticalPush(boolean sprintHit) {
        RollingStats st = sprintHit ? this.sprintVertical : this.walkVertical;
        double prior = sprintHit ? PRIOR_SPRINT_VERTICAL : PRIOR_WALK_VERTICAL;
        return blend(st, prior);
    }

    /**
     * Estimated separation a landed hit creates, in blocks. This is the number
     * the spacing and W-tap logic actually plans around.
     */
    public double separationGain(boolean sprintHit) {
        RollingStats st = sprintHit ? this.sprintSeparation : this.walkSeparation;
        double prior = sprintHit ? PRIOR_SPRINT_SEPARATION : PRIOR_WALK_SEPARATION;
        return blend(st, prior);
    }

    /** Separation created when we are the one being hit, or the prior if unmeasured. */
    public double incomingSeparation() {
        if (this.incomingSeparation.count() == 0) {
            return PRIOR_SPRINT_SEPARATION;
        }
        double weight = blendWeight(this.incomingSeparation);
        return PRIOR_SPRINT_SEPARATION * (1.0D - weight) + weighted(this.incomingSeparation) * weight;
    }

    /**
     * Measured ticks between sending an attack and seeing the target react.
     * Returns -1 when nothing has been measured yet.
     */
    public double reactionTicks() {
        return this.reaction.count() == 0 ? -1.0D : weighted(this.reaction);
    }

    public double confidence(boolean sprintHit) {
        RollingStats st = sprintHit ? this.sprintSeparation : this.walkSeparation;
        return st.confidence(CONFIDENCE_SATURATION);
    }

    /** Best confidence across both hit types, for display and gating. */
    public double overallConfidence() {
        return Math.max(confidence(true), confidence(false));
    }

    /** True once the estimate for this hit type rests on real observations. */
    public boolean isMeasured(boolean sprintHit) {
        return (sprintHit ? this.sprintSeparation : this.walkSeparation).count() >= 2;
    }

    public int sampleCount(boolean sprintHit) {
        return (sprintHit ? this.sprintSeparation : this.walkSeparation).count();
    }

    public int totalObservations() {
        return this.totalObservations;
    }

    public boolean regimeChangeSeen() {
        return this.lastRegimeChangeAt >= 0L;
    }

    /**
     * Spread of the separation samples, in blocks. High spread means the server
     * is inconsistent (or we are mis-attributing hits) and callers should widen
     * their safety margin.
     */
    public double separationSpread(boolean sprintHit) {
        return (sprintHit ? this.sprintSeparation : this.walkSeparation).stdDev();
    }

    public void reset() {
        this.walkHorizontal.clear();
        this.sprintHorizontal.clear();
        this.walkVertical.clear();
        this.sprintVertical.clear();
        this.walkSeparation.clear();
        this.sprintSeparation.clear();
        this.incomingSeparation.clear();
        this.reaction.clear();
        this.regimeStrikes = 0;
        this.baselineFrozen = false;
        this.lastRegimeChangeAt = -1L;
        this.totalObservations = 0;
    }

    private void trackRegime(RollingStats h, double value) {
        if (!this.baselineFrozen) {
            if (isOutlier(h, value)) {
                this.baselineFrozen = true;
                this.baselineMean = h.mean();
                this.baselineTolerance = tolerance(h);
                this.regimeStrikes = 1;
            }
            return;
        }
        if (Math.abs(value - this.baselineMean) > this.baselineTolerance) {
            this.regimeStrikes++;
            if (this.regimeStrikes >= REGIME_CHANGE_STRIKES) {
                // Keep the recent half so the estimate can move to the new
                // regime without discarding everything learned here.
                decayAll();
                this.regimeStrikes = 0;
                this.baselineFrozen = false;
                this.lastRegimeChangeAt = this.totalObservations;
            }
        } else {
            this.regimeStrikes = 0;
            this.baselineFrozen = false;
        }
    }

    private void decayAll() {
        this.walkHorizontal.decay();
        this.sprintHorizontal.decay();
        this.walkVertical.decay();
        this.sprintVertical.decay();
        this.walkSeparation.decay();
        this.sprintSeparation.decay();
    }

    private double blend(RollingStats st, double prior) {
        if (st.count() == 0) {
            return prior;
        }
        double weight = blendWeight(st);
        return prior * (1.0D - weight) + weighted(st) * weight;
    }

    /**
     * How much of the reported value comes from measurement rather than the
     * prior.
     *
     * <p>Deliberately separate from {@link #confidence(boolean)} and faster to
     * saturate: "what is the best estimate of this number" and "is this solid
     * enough to move the player on" are different questions. A dozen
     * consistent samples should dominate the prior for reporting purposes while
     * still being only moderately confident for gating purposes.</p>
     */
    private static double blendWeight(RollingStats st) {
        int n = st.count();
        if (n == 0) {
            return 0.0D;
        }
        double sampleTerm = (double) n / (double) (n + 2);
        double spreadTerm = 1.0D / (1.0D + 0.5D * st.coefficientOfVariation());
        return RollingStats.clamp(sampleTerm * spreadTerm, 0.0D, 0.98D);
    }

    /**
     * True when a sample does not plausibly belong to the window we have built.
     *
     * <p>Uses a z-score where there is usable spread, and falls back to a
     * relative gap test where there is not: a perfectly consistent window has
     * no sigma to divide by, and that is exactly the case where a genuine rule
     * change is most obvious.</p>
     */
    private static boolean isOutlier(RollingStats st, double value) {
        if (st.count() < 4) {
            return false;
        }
        return Math.abs(value - st.mean()) > tolerance(st);
    }

    /**
     * How far from the window mean a sample may sit before it looks like a
     * different rule. A z-score where there is usable spread; a relative gap
     * where there is not, since a perfectly consistent window has no sigma to
     * divide by and that is exactly where a real change is most obvious.
     */
    private static double tolerance(RollingStats st) {
        double sd = st.stdDev();
        if (sd > 1.0E-3D) {
            return REGIME_CHANGE_Z * sd;
        }
        return Math.max(0.25D, 0.5D * Math.abs(st.mean()));
    }

    /**
     * Mixes the window mean with the EWMA according to the learning rate, so a
     * high learning rate follows recent hits and a low one stays steady.
     */
    private double weighted(RollingStats st) {
        return st.mean() * (1.0D - this.learningRate) + st.ewma() * this.learningRate;
    }

    // ------------------------------------------------------------------
    // Persistence. Plain string map so the client layer can store it in a
    // properties file without this class touching the file system.
    // ------------------------------------------------------------------

    public Map<String, String> toMap() {
        Map<String, String> out = new LinkedHashMap<String, String>();
        out.put("serverKey", this.serverKey);
        out.put("observations", Integer.toString(this.totalObservations));
        putStats(out, "walkH", this.walkHorizontal);
        putStats(out, "sprintH", this.sprintHorizontal);
        putStats(out, "walkV", this.walkVertical);
        putStats(out, "sprintV", this.sprintVertical);
        putStats(out, "walkSep", this.walkSeparation);
        putStats(out, "sprintSep", this.sprintSeparation);
        putStats(out, "inSep", this.incomingSeparation);
        putStats(out, "react", this.reaction);
        return out;
    }

    public void fromMap(Map<String, String> in) {
        if (in == null) {
            return;
        }
        reset();
        this.serverKey = in.containsKey("serverKey") ? in.get("serverKey") : this.serverKey;
        readStats(in, "walkH", this.walkHorizontal);
        readStats(in, "sprintH", this.sprintHorizontal);
        readStats(in, "walkV", this.walkVertical);
        readStats(in, "sprintV", this.sprintVertical);
        readStats(in, "walkSep", this.walkSeparation);
        readStats(in, "sprintSep", this.sprintSeparation);
        readStats(in, "inSep", this.incomingSeparation);
        readStats(in, "react", this.reaction);
        this.totalObservations = parseInt(in.get("observations"));
    }

    private static void putStats(Map<String, String> out, String key, RollingStats st) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < st.count(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(String.format("%.4f", st.get(i)));
        }
        out.put(key, sb.toString());
    }

    private static void readStats(Map<String, String> in, String key, RollingStats st) {
        String raw = in.get(key);
        if (raw == null || raw.isEmpty()) {
            return;
        }
        String[] parts = raw.split(",");
        for (String p : parts) {
            try {
                st.push(Double.parseDouble(p.trim()));
            } catch (NumberFormatException ignored) {
                // A corrupt entry just means one fewer sample.
            }
        }
    }

    private static int parseInt(String s) {
        if (s == null) {
            return 0;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** Compact one-line summary for the debug overlay. */
    public String describe(boolean sprintHit) {
        boolean measured = isMeasured(sprintHit);
        return String.format("%s sep%.2f h%.2f n=%d conf%.0f%%",
                measured ? "msr" : "prior",
                separationGain(sprintHit), horizontalPush(sprintHit),
                sampleCount(sprintHit), confidence(sprintHit) * 100.0D);
    }
}
