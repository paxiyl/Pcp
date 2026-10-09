package dev.paxiyl.pcp.core;

/**
 * Chooses W-tap and S-tap actions and their durations.
 *
 * <p>There is no fixed delay anywhere in here. Every duration is built from the
 * current movement state, the measured knockback separation, the spacing band
 * and the latency uncertainty, then clamped into the configured
 * {@code [minTapTicks, maxTapTicks]} window.</p>
 *
 * <p><b>Risk ladder.</b> Releasing a key the player is already holding (W-tap)
 * is a smaller intervention than asking for a key they are not holding
 * (S-tap), so the two are gated differently: a minimum-length W-tap is allowed
 * while the knockback profile is still unsure, but S-tap, and any tap longer
 * than the minimum, require {@link CoreSettings#minConfidence()} to be met.
 * Neither runs while latency looks unreliable.</p>
 */
public final class TapPlanner {

    /**
     * Below this measured separation per hit, a sprint reset buys almost
     * nothing and costs forward pressure, so W-tap is skipped. Only applied
     * once the profile is confident enough to trust the number.
     */
    private static final double WTAP_MIN_SEPARATION = 0.45D;
    /** Separation above which holding the release a tick longer is free. */
    private static final double WTAP_WIDE_SEPARATION = 1.50D;
    /** Fallback horizontal speed in blocks/tick when we have no better number. */
    private static final double FALLBACK_SPEED = 0.20D;

    private final MovementPlan plan = new MovementPlan();

    private MoveAction lastAction = MoveAction.NONE;
    private long lastActionEndTick = Long.MIN_VALUE;
    /** Identity of the hit a W-tap has already been issued for. */
    private long handledHitTick = Long.MIN_VALUE;
    private int wTaps;
    private int sTaps;

    public MovementPlan plan(CombatSnapshot s, CoreSettings cfg, KnockbackProfile kb,
                             FightState state, SpacingZone zone, boolean suspended) {
        this.plan.clear("idle");

        if (suspended) {
            this.plan.clear("suspended");
            return this.plan;
        }
        if (!cfg.masterEnabled) {
            this.plan.clear("mod off");
            return this.plan;
        }
        if (!s.hasTarget || !state.allowsMovementAssist()) {
            this.plan.clear("no engagement");
            return this.plan;
        }
        if (!s.latencyReliable) {
            // Spec'd behaviour: when the latency picture degrades, stop making
            // movement corrections rather than correcting on stale data.
            this.plan.clear("latency unreliable");
            return this.plan;
        }
        if (cooldownRemaining(s.tick, cfg) > 0) {
            this.plan.clear("cooldown " + cooldownRemaining(s.tick, cfg) + "t");
            return this.plan;
        }

        // Two different questions, two different numbers. A W-tap is a reaction
        // to the hit we just landed, so it is gated on confidence in that hit
        // type. An S-tap is about spacing in general, so it is gated on the
        // best confidence the profile has in anything.
        double hitConfidence = kb.confidence(s.lastHitWasSprint);
        double spacingConfidence = kb.overallConfidence();

        MovementPlan wtap = planWTap(s, cfg, kb, state, hitConfidence,
                hitConfidence >= cfg.minConfidence());
        if (wtap != null) {
            return wtap;
        }
        MovementPlan stap = planSTap(s, cfg, kb, state, zone, spacingConfidence,
                spacingConfidence >= cfg.minConfidence());
        if (stap != null) {
            return stap;
        }
        return this.plan;
    }

    // ------------------------------------------------------------------
    // W-tap: release forward so 1.8.9's own sprint logic re-arms the sprint.
    // ------------------------------------------------------------------
    private MovementPlan planWTap(CombatSnapshot s, CoreSettings cfg, KnockbackProfile kb,
                                   FightState state, double confidence, boolean confident) {
        if (!cfg.wTapEnabled) {
            return null;
        }
        if (state != FightState.ENGAGEMENT && state != FightState.COMBO && state != FightState.TRADE) {
            return null;
        }
        // Only ever release a key the player is already asking for.
        if (!s.playerWantsForward()) {
            return null;
        }
        // The sprint reset is only worth anything if we were actually sprinting.
        if (!s.selfSprinting) {
            return null;
        }

        // Fire on a freshly confirmed hit, inside a window that widens with
        // latency uncertainty so a laggy link still catches its own hit.
        int window = 1 + (int) Math.floor(s.latencyUncertaintyTicks);
        if (!s.ourHitWithin(window)) {
            return null;
        }
        long hitTick = s.tick - s.ticksSinceOurHit;
        if (hitTick == this.handledHitTick) {
            return null;
        }

        double separation = kb.separationGain(s.lastHitWasSprint);
        if (confident && separation < WTAP_MIN_SEPARATION) {
            // Measured knockback here is tiny: tapping would interrupt a combo
            // that is already working.
            this.plan.clear(String.format("no tap: sep %.2f measured low", separation));
            return this.plan;
        }
        if (this.lastAction == MoveAction.S_TAP
                && s.tick - this.lastActionEndTick < cfg.directionFlipGuardTicks()) {
            this.plan.clear("flip guard after S-tap");
            return this.plan;
        }

        int ticks = cfg.minTapTicks();
        if (confident) {
            // Spend the extra tick only where it is cheap: a wide knockback gap
            // means we could not have reached them during that tick anyway.
            ticks += (int) Math.round(s.latencyUncertaintyTicks * 0.5D);
            if (separation >= WTAP_WIDE_SEPARATION) {
                ticks += 1;
            }
        }
        ticks = clampTicks(ticks, cfg);

        this.handledHitTick = hitTick;
        this.wTaps++;
        this.plan.set(MoveAction.W_TAP, ticks,
                String.format("sprint reset: hit %dt ago, sep %.2f%s, unc %.1ft",
                        s.ticksSinceOurHit, separation, kb.isMeasured(s.lastHitWasSprint) ? "" : " (prior)",
                        s.latencyUncertaintyTicks),
                confidence);
        return this.plan;
    }

    // ------------------------------------------------------------------
    // S-tap: small, bounded backward correction to restore the combo band.
    // ------------------------------------------------------------------
    private MovementPlan planSTap(CombatSnapshot s, CoreSettings cfg, KnockbackProfile kb,
                                   FightState state, SpacingZone zone, double confidence, boolean confident) {
        if (!cfg.sTapEnabled || !cfg.spacingEnabled) {
            return null;
        }
        if (zone != SpacingZone.DANGER_CLOSE && zone != SpacingZone.WALK_IN_RISK) {
            return null;
        }
        if (state == FightState.APPROACH) {
            return null;
        }
        // Asking for a key the player is not holding needs the profile to be
        // worth trusting.
        if (!confident) {
            this.plan.clear(String.format("S-tap needs conf %.0f%% (have %.0f%%)",
                    cfg.minConfidence() * 100.0D, confidence * 100.0D));
            return this.plan;
        }
        // Already backing off under their own control: leave it alone.
        if (s.selfForwardInput < -0.1D) {
            return null;
        }
        if (this.lastAction == MoveAction.W_TAP
                && s.tick - this.lastActionEndTick < cfg.directionFlipGuardTicks()) {
            this.plan.clear("flip guard after W-tap");
            return this.plan;
        }

        double speed = backSpeedEstimate(s);
        int needed = SpacingModel.ticksToRecoverBand(s, cfg, speed);
        if (needed == 0) {
            return null;
        }
        if (needed < 0) {
            // They close faster than we can retreat; backing up would only
            // bleed pressure without fixing the gap.
            this.plan.clear("retreat cannot outpace their closing");
            return this.plan;
        }

        int ticks = clampTicks(needed, cfg);
        // Do not open the gap past effective range: that throws away the
        // engagement instead of tightening the spacing.
        double projected = s.distance + speed * ticks - Math.max(0.0D, s.targetClosingComponent) * ticks;
        if (projected > cfg.effectiveRange()) {
            int reduced = (int) Math.floor((cfg.effectiveRange() - s.distance)
                    / Math.max(0.01D, speed - Math.max(0.0D, s.targetClosingComponent)));
            if (reduced < cfg.minTapTicks()) {
                this.plan.clear(String.format("S-tap would overshoot to %.2f", projected));
                return this.plan;
            }
            ticks = clampTicks(reduced, cfg);
        }

        this.sTaps++;
        this.plan.set(MoveAction.S_TAP, ticks,
                String.format("%s at %.2f, want %.2f (their closing %.2f)",
                        zone == SpacingZone.WALK_IN_RISK ? "incoming swing" : "too close",
                        s.distance, cfg.comboBandDistance(), s.targetClosingComponent),
                confidence);
        return this.plan;
    }

    /**
     * Backward speed estimate in blocks/tick. Derived from our observed
     * horizontal speed where available, clamped to plausible on-foot values;
     * documented as an estimate because potions, ice and server movement
     * handling all change it and none of that is directly readable.
     */
    private double backSpeedEstimate(CombatSnapshot s) {
        double speed = s.selfSpeed > 0.02D ? s.selfSpeed : FALLBACK_SPEED;
        return RollingStats.clamp(speed, 0.10D, 0.35D);
    }

    private int clampTicks(int ticks, CoreSettings cfg) {
        return (int) RollingStats.clamp(ticks, cfg.minTapTicks(), cfg.maxTapTicks());
    }

    public int cooldownRemaining(long tick, CoreSettings cfg) {
        if (this.lastActionEndTick == Long.MIN_VALUE) {
            return 0;
        }
        long ready = this.lastActionEndTick + cfg.actionCooldownTicks();
        return (int) Math.max(0L, ready - tick);
    }

    /** Called by the controller once an action really started. */
    public void onActionStarted(MoveAction action, int durationTicks, long tick) {
        this.lastAction = action;
        this.lastActionEndTick = tick + durationTicks;
    }

    public int wTapCount() {
        return this.wTaps;
    }

    public int sTapCount() {
        return this.sTaps;
    }

    public MoveAction lastAction() {
        return this.lastAction;
    }

    public void reset() {
        this.lastAction = MoveAction.NONE;
        this.lastActionEndTick = Long.MIN_VALUE;
        this.handledHitTick = Long.MIN_VALUE;
        this.plan.clear("reset");
    }
}
