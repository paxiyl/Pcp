package dev.paxiyl.pcp.core;

/**
 * Mid-trade hit selection.
 *
 * <p>Called when the player asks to attack. It answers with one of: send it
 * now, hold it for a bounded number of ticks, or let the movement correction
 * land first. It never creates an attack the player did not ask for, and it
 * never drops one: the hold is capped by
 * {@link CoreSettings#maxTradeDelayTicks()} and the attack is released when the
 * cap expires whatever else is true.</p>
 *
 * <p>Delaying is not assumed to be good. The checks below look for the ways
 * waiting can cost more than it buys - losing range, eating an uncontested hit,
 * or giving up a sprint hit we already have - and send the attack immediately
 * in all of those cases.</p>
 */
public final class TradeDecider {

    /** Their swing is considered "in flight" for this many ticks. */
    private static final int SWING_IN_FLIGHT_TICKS = 3;
    /** Facing dot above which we treat the opponent as aimed at us. */
    private static final double AIMED_AT_US = 0.6D;

    private final TradeAdvice advice = new TradeAdvice();
    private int holds;
    private int immediate;

    public TradeAdvice decide(CombatSnapshot s, CoreSettings cfg, KnockbackProfile kb,
                              FightState state, SpacingZone zone, MovementPlan activePlan,
                              boolean suspended, boolean manualOverride) {
        if (manualOverride) {
            return now(s, "manual override");
        }
        if (suspended || !cfg.masterEnabled || !cfg.tradeTimingEnabled) {
            return now(s, "trade assist off");
        }
        if (!s.hasTarget) {
            return now(s, "no target");
        }
        if (cfg.maxTradeDelayTicks() <= 0) {
            return now(s, "delay cap is 0");
        }
        // Degraded latency: stop gating and let the player's click through.
        if (!s.latencyReliable) {
            return now(s, "latency unreliable");
        }

        double confidence = kb.overallConfidence();
        if (confidence < cfg.minConfidence()) {
            return now(s, String.format("conf %.0f%% < %.0f%%",
                    confidence * 100.0D, cfg.minConfidence() * 100.0D));
        }

        // Being hit right now: holding would just mean taking the hit and
        // giving up the answer.
        if (s.selfHurtTime > 0 || s.hitTakenWithin(1)) {
            return now(s, "contested: answering now");
        }

        double reach = cfg.effectiveRange();

        // Out of range but closing: hold just long enough to connect instead
        // of burning the swing on air.
        if (s.distance > reach) {
            int ticks = ticksUntilInRange(s, reach);
            if (ticks > 0 && ticks <= cfg.maxTradeDelayTicks()) {
                return hold(s, TradeDecision.DELAY, ticks,
                        String.format("range in %dt (%.2f -> %.2f)", ticks, s.distance, reach));
            }
            return now(s, String.format("out of range %.2f, not closing in time", s.distance));
        }

        // A sprint hit is the strongest thing we have; do not trade it away by
        // waiting, since the sprint can be lost in a tick.
        if (s.selfSprinting && s.playerWantsForward()) {
            boolean kbWorthIt = !kb.isMeasured(true) || kb.separationGain(true) > kb.separationGain(false);
            if (kbWorthIt) {
                return now(s, String.format("sprint hit ready (sep %.2f)", kb.separationGain(true)));
            }
        }

        // Their swing is already in flight and we are in the band where both
        // connect. Holding briefly means their knockback lands first, the gap
        // opens, and our sprint has a chance to re-arm.
        boolean swingInFlight = s.targetSwinging && s.targetSwingAgeTicks >= 0
                && s.targetSwingAgeTicks <= SWING_IN_FLIGHT_TICKS;
        if (swingInFlight && s.targetFacingDot > AIMED_AT_US && zone == SpacingZone.DANGER_CLOSE) {
            int ticks = Math.min(cfg.maxTradeDelayTicks(),
                    1 + (int) Math.round(s.latencyUncertaintyTicks * 0.5D));
            if (!losesRange(s, cfg, ticks)) {
                return hold(s, TradeDecision.DELAY, ticks,
                        String.format("their swing %dt old, avoiding simultaneous trade", s.targetSwingAgeTicks));
            }
            return now(s, "would lose range while waiting");
        }

        // A movement correction is mid-flight: let it finish so the hit lands
        // from the spacing the correction is creating.
        if (activePlan != null && activePlan.isActive()
                && (zone == SpacingZone.WALK_IN_RISK || zone == SpacingZone.DANGER_CLOSE)) {
            int ticks = Math.min(cfg.maxTradeDelayTicks(), activePlan.durationTicks);
            if (ticks > 0 && !losesRange(s, cfg, ticks)) {
                return hold(s, TradeDecision.REPOSITION, ticks,
                        "waiting out " + activePlan.action.label() + " for better spacing");
            }
        }

        // Knockback gap that is about to close on its own: a hit now whiffs,
        // a hit in a tick or two connects.
        if (zone == SpacingZone.KNOCKBACK_GAP) {
            int ticks = ticksUntilInRange(s, reach);
            if (ticks > 0 && ticks <= cfg.maxTradeDelayTicks()) {
                return hold(s, TradeDecision.DELAY, ticks,
                        String.format("knockback gap closing in %dt", ticks));
            }
        }

        return now(s, String.format("clear window at %.2f", s.distance));
    }

    /** True when waiting {@code ticks} would carry us out of effective range. */
    private boolean losesRange(CombatSnapshot s, CoreSettings cfg, int ticks) {
        double projected = s.distance - s.closingSpeed * ticks;
        return projected > cfg.effectiveRange();
    }

    private int ticksUntilInRange(CombatSnapshot s, double reach) {
        if (s.closingSpeed <= 0.02D) {
            return -1;
        }
        double deficit = s.distance - reach;
        if (deficit <= 0.0D) {
            return 0;
        }
        return (int) Math.ceil(deficit / s.closingSpeed);
    }

    private TradeAdvice now(CombatSnapshot s, String reason) {
        this.immediate++;
        this.advice.set(TradeDecision.ATTACK_NOW, 0, reason);
        return this.advice;
    }

    private TradeAdvice hold(CombatSnapshot s, TradeDecision decision, int ticks, String reason) {
        this.holds++;
        this.advice.set(decision, ticks, reason);
        return this.advice;
    }

    public int holdCount() {
        return this.holds;
    }

    public int immediateCount() {
        return this.immediate;
    }

    /** Last advice produced, for the overlay. */
    public TradeAdvice last() {
        return this.advice;
    }
}
