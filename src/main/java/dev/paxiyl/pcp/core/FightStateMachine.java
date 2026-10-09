package dev.paxiyl.pcp.core;

/**
 * Explicit fight-state machine.
 *
 * <p>Every transition is driven by observable evidence - distance, recent
 * confirmed hits, hits taken, hurt timers - and by configurable thresholds.
 * Three guards keep it honest:</p>
 *
 * <ul>
 *   <li>a minimum dwell time, so ordinary transitions cannot flap tick to tick;</li>
 *   <li>safety transitions (target lost, we got hit) that bypass the dwell;</li>
 *   <li>a stuck guard that drops back to {@link FightState#IDLE} if any state
 *       persists past {@link CoreSettings#stateStuckTicks()} without fresh
 *       evidence, so the controller can never sit in one state forever.</li>
 * </ul>
 */
public final class FightStateMachine {

    /** Ticks a state must be held before a non-safety transition may fire. */
    private static final int MIN_DWELL_TICKS = 2;
    /** A confirmed hit keeps combo pressure alive for this long. */
    private static final int COMBO_WINDOW = 10;
    /** Both sides landing something inside this window means a trade. */
    private static final int TRADE_WINDOW = 8;
    /** Hits taken minus hits landed at or above this triggers a disengage. */
    private static final int DISENGAGE_DEFICIT = 2;
    /** Bounded time spent in DISENGAGE before re-evaluating normally. */
    private static final int DISENGAGE_TICKS = 25;

    private FightState state = FightState.IDLE;
    private long stateSince;
    private long lastEvidenceTick;
    private String reason = "init";
    private int disengageHold;
    private int transitions;

    public FightState state() {
        return this.state;
    }

    public String reason() {
        return this.reason;
    }

    public int ticksInState(long tick) {
        return (int) Math.max(0L, tick - this.stateSince);
    }

    public int transitions() {
        return this.transitions;
    }

    public void reset(String why) {
        this.state = FightState.IDLE;
        this.stateSince = 0L;
        this.lastEvidenceTick = 0L;
        this.disengageHold = 0;
        this.reason = why == null ? "reset" : why;
    }

    public FightState update(CombatSnapshot s, CoreSettings cfg, SpacingZone zone) {
        long tick = s.tick;
        double reach = cfg.effectiveRange();

        // ---- safety transitions, no dwell requirement ----
        if (!s.hasTarget || s.distance > cfg.maxTargetDistance()) {
            return force(FightState.IDLE, tick, s.hasTarget ? "target out of range" : "no valid target");
        }

        if (this.disengageHold > 0) {
            this.disengageHold--;
        }

        // Taking a hit always moves us to recovery: our spacing just changed
        // under us and any movement plan built before it is stale.
        if (s.hitTakenWithin(1)) {
            this.lastEvidenceTick = tick;
            return force(FightState.RECOVERY, tick, "took a hit");
        }

        // A run of hits taken without answering is the evidence-based case for
        // breaking off rather than continuing to trade.
        if (s.recentHitsTaken - s.recentHitsLanded >= DISENGAGE_DEFICIT && s.distance <= reach) {
            this.disengageHold = DISENGAGE_TICKS;
            this.lastEvidenceTick = tick;
            return force(FightState.DISENGAGE, tick,
                    "losing exchange " + s.recentHitsLanded + "-" + s.recentHitsTaken);
        }

        // ---- stuck guard ----
        // Only ever fires out of a non-idle state. Applying it to IDLE would be
        // self-defeating: IDLE is the resting state, so after a long quiet spell
        // the guard would re-assert IDLE on every tick and the machine could
        // never pick a fight up again.
        if (this.state != FightState.IDLE
                && ticksInState(tick) > cfg.stateStuckTicks()
                && tick - this.lastEvidenceTick > cfg.stateStuckTicks()) {
            return force(FightState.IDLE, tick, "stuck guard after " + ticksInState(tick) + "t");
        }

        if (ticksInState(tick) < MIN_DWELL_TICKS) {
            return this.state;
        }

        boolean ourHit = s.ourHitWithin(COMBO_WINDOW);
        boolean theirHit = s.hitTakenWithin(TRADE_WINDOW);
        boolean inRange = s.distance <= reach;

        if (ourHit || theirHit) {
            this.lastEvidenceTick = tick;
        }

        // Both sides connecting recently, at range: this is a trade.
        if (inRange && s.ourHitWithin(TRADE_WINDOW) && theirHit) {
            return to(FightState.TRADE, tick, "both landed inside " + TRADE_WINDOW + "t");
        }

        switch (this.state) {
            case IDLE:
                return inRange
                        ? to(FightState.ENGAGEMENT, tick, String.format("target at %.2f", s.distance))
                        : to(FightState.APPROACH, tick, String.format("closing from %.2f", s.distance));

            case APPROACH:
                if (zone == SpacingZone.WALK_IN_RISK) {
                    return to(FightState.ENGAGEMENT, tick, "incoming swing while closing");
                }
                if (inRange || zone == SpacingZone.ENTERING) {
                    return to(FightState.ENGAGEMENT, tick, String.format("entered range at %.2f", s.distance));
                }
                return this.state;

            case ENGAGEMENT:
                if (ourHit) {
                    return to(FightState.COMBO, tick, "hit confirmed, keeping pressure");
                }
                if (!inRange && zone != SpacingZone.ENTERING) {
                    return to(FightState.APPROACH, tick, String.format("lost range at %.2f", s.distance));
                }
                return this.state;

            case COMBO:
                if (!ourHit) {
                    // Pressure has run out: either we are still in range and
                    // re-engaging, or the gap is open and we are approaching.
                    return inRange
                            ? to(FightState.ENGAGEMENT, tick, "combo window expired in range")
                            : to(FightState.APPROACH, tick, "combo window expired, gap open");
                }
                if (zone == SpacingZone.DANGER_CLOSE && s.targetSwinging) {
                    return to(FightState.TRADE, tick, "combo collapsed into close range");
                }
                return this.state;

            case RECOVERY:
                if (s.selfHurtTime > 0 || s.hitTakenWithin(4)) {
                    return this.state;
                }
                if (inRange) {
                    return to(FightState.ENGAGEMENT, tick, "recovered in range");
                }
                return to(FightState.APPROACH, tick, String.format("recovered, re-closing %.2f", s.distance));

            case DISENGAGE:
                if (this.disengageHold > 0) {
                    return this.state;
                }
                return inRange
                        ? to(FightState.ENGAGEMENT, tick, "disengage over, still in range")
                        : to(FightState.APPROACH, tick, "disengage over, re-approaching");

            case TRADE:
            default:
                if (!inRange) {
                    return to(FightState.APPROACH, tick, "trade broke, gap open");
                }
                if (!theirHit && ourHit) {
                    return to(FightState.COMBO, tick, "trade won, pressure ours");
                }
                if (!theirHit && !ourHit) {
                    return to(FightState.ENGAGEMENT, tick, "trade cooled off");
                }
                return this.state;
        }
    }

    private FightState to(FightState next, long tick, String why) {
        if (next == this.state) {
            return this.state;
        }
        return force(next, tick, why);
    }

    private FightState force(FightState next, long tick, String why) {
        if (next != this.state) {
            this.state = next;
            this.stateSince = tick;
            this.transitions++;
        }
        this.reason = why;
        return this.state;
    }
}
