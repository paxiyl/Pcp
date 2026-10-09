package dev.paxiyl.pcp.core;

/**
 * Every tunable the decision core reads.
 *
 * <p>Kept free of Forge types so the logic can be exercised head-less. The
 * client layer owns a single instance and copies the config file into it; all
 * setters clamp, so a hand-edited config cannot push the controller outside
 * safe bounds.</p>
 */
public final class CoreSettings {

    // Module switches
    public boolean masterEnabled = true;
    public boolean wTapEnabled = true;
    public boolean sTapEnabled = true;
    public boolean tradeTimingEnabled = true;
    public boolean spacingEnabled = true;
    public boolean debugOverlay = false;

    // Movement bounds
    private int minTapTicks = 1;
    private int maxTapTicks = 4;
    private int actionCooldownTicks = 6;
    /** Minimum ticks between two actions that pull in opposite directions. */
    private int directionFlipGuardTicks = 8;
    private int maxTradeDelayTicks = 3;

    // Spacing
    /**
     * Effective attack range estimate in blocks. Vanilla 1.8.9 resolves hits
     * out to about 3.0 for players, but servers vary and lag-compensating
     * anti-cheats effectively change it, so this is a per-server setting rather
     * than a constant.
     */
    private double effectiveRange = 3.0D;
    /** Fraction of effective range that counts as the favourable combo band. */
    private double comboBandFraction = 0.72D;
    /** Below this fraction of effective range we are inside a trade. */
    private double dangerCloseFraction = 0.55D;
    /** Ticks ahead the spacing model projects the gap. */
    private int predictionTicks = 3;

    // Learning / gating
    private double learningRate = 0.25D;
    /** Confidence the knockback profile must reach before automatic corrections run. */
    private double minConfidence = 0.35D;
    /** Ticks a target may go unseen before it stops being a target. */
    private int targetTimeoutTicks = 40;
    /** Max ticks any non-idle state may persist without fresh evidence. */
    private int stateStuckTicks = 120;
    /** Targets beyond this are ignored entirely. */
    private double maxTargetDistance = 7.0D;

    public int minTapTicks() {
        return this.minTapTicks;
    }

    public void setMinTapTicks(int v) {
        this.minTapTicks = (int) RollingStats.clamp(v, 1, 10);
        if (this.maxTapTicks < this.minTapTicks) {
            this.maxTapTicks = this.minTapTicks;
        }
    }

    public int maxTapTicks() {
        return this.maxTapTicks;
    }

    public void setMaxTapTicks(int v) {
        this.maxTapTicks = (int) RollingStats.clamp(v, 1, 10);
        if (this.minTapTicks > this.maxTapTicks) {
            this.minTapTicks = this.maxTapTicks;
        }
    }

    public int actionCooldownTicks() {
        return this.actionCooldownTicks;
    }

    public void setActionCooldownTicks(int v) {
        this.actionCooldownTicks = (int) RollingStats.clamp(v, 0, 60);
    }

    public int directionFlipGuardTicks() {
        return this.directionFlipGuardTicks;
    }

    public void setDirectionFlipGuardTicks(int v) {
        this.directionFlipGuardTicks = (int) RollingStats.clamp(v, 0, 60);
    }

    public int maxTradeDelayTicks() {
        return this.maxTradeDelayTicks;
    }

    public void setMaxTradeDelayTicks(int v) {
        this.maxTradeDelayTicks = (int) RollingStats.clamp(v, 0, 6);
    }

    public double effectiveRange() {
        return this.effectiveRange;
    }

    public void setEffectiveRange(double v) {
        this.effectiveRange = RollingStats.clamp(v, 2.0D, 4.5D);
    }

    public double comboBandFraction() {
        return this.comboBandFraction;
    }

    public void setComboBandFraction(double v) {
        this.comboBandFraction = RollingStats.clamp(v, 0.4D, 0.95D);
        if (this.dangerCloseFraction > this.comboBandFraction - 0.05D) {
            this.dangerCloseFraction = this.comboBandFraction - 0.05D;
        }
    }

    public double dangerCloseFraction() {
        return this.dangerCloseFraction;
    }

    public void setDangerCloseFraction(double v) {
        this.dangerCloseFraction = RollingStats.clamp(v, 0.2D, 0.9D);
        if (this.comboBandFraction < this.dangerCloseFraction + 0.05D) {
            this.comboBandFraction = RollingStats.clamp(this.dangerCloseFraction + 0.05D, 0.4D, 0.95D);
        }
    }

    public int predictionTicks() {
        return this.predictionTicks;
    }

    public void setPredictionTicks(int v) {
        this.predictionTicks = (int) RollingStats.clamp(v, 1, 10);
    }

    public double learningRate() {
        return this.learningRate;
    }

    public void setLearningRate(double v) {
        this.learningRate = RollingStats.clamp(v, 0.05D, 1.0D);
    }

    public double minConfidence() {
        return this.minConfidence;
    }

    public void setMinConfidence(double v) {
        this.minConfidence = RollingStats.clamp(v, 0.0D, 0.95D);
    }

    public int targetTimeoutTicks() {
        return this.targetTimeoutTicks;
    }

    public void setTargetTimeoutTicks(int v) {
        this.targetTimeoutTicks = (int) RollingStats.clamp(v, 5, 200);
    }

    public int stateStuckTicks() {
        return this.stateStuckTicks;
    }

    public void setStateStuckTicks(int v) {
        this.stateStuckTicks = (int) RollingStats.clamp(v, 20, 600);
    }

    public double maxTargetDistance() {
        return this.maxTargetDistance;
    }

    public void setMaxTargetDistance(double v) {
        this.maxTargetDistance = RollingStats.clamp(v, 3.0D, 16.0D);
    }

    // Derived bands, in blocks
    public double comboBandDistance() {
        return this.effectiveRange * this.comboBandFraction;
    }

    public double dangerCloseDistance() {
        return this.effectiveRange * this.dangerCloseFraction;
    }
}
