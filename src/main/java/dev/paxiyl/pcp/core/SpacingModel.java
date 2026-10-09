package dev.paxiyl.pcp.core;

/**
 * Turns a raw distance into a band the rest of the system can reason about, and
 * projects where that distance is heading.
 *
 * <p>Range is a configured estimate, not a known quantity: vanilla 1.8.9
 * resolves player hits out to roughly three blocks, but server software and
 * lag compensation move the practical number, so every band is derived from
 * {@link CoreSettings#effectiveRange()} rather than a constant. Being inside a
 * band says the gap is favourable, never that the opponent cannot reach us.</p>
 */
public final class SpacingModel {

    /** How far past effective range still counts as "about to be in range". */
    private static final double ENTERING_MARGIN = 0.75D;
    /** Closing speed below which the gap is treated as stable. */
    private static final double STABLE_CLOSING = 0.02D;

    private String rationale = "no target";

    /**
     * Straight-line projection of the gap {@code ticks} ahead using the
     * currently observed closing speed. Deliberately linear: over the two to
     * four ticks that matter, acceleration and knockback decay are smaller than
     * the error in the inputs, and a cheap prediction keeps the tick loop fast.
     */
    public double predictedDistance(CombatSnapshot s, int ticks) {
        if (!s.hasTarget) {
            return Double.MAX_VALUE;
        }
        double d = s.distance - s.closingSpeed * ticks;
        return d < 0.0D ? 0.0D : d;
    }

    public SpacingZone classify(CombatSnapshot s, CoreSettings cfg, KnockbackProfile kb) {
        if (!s.hasTarget) {
            this.rationale = "no target";
            return SpacingZone.OUT_OF_RANGE;
        }

        double reach = cfg.effectiveRange();
        double combo = cfg.comboBandDistance();
        double danger = cfg.dangerCloseDistance();
        double d = s.distance;
        double predicted = predictedDistance(s, cfg.predictionTicks());

        // A gap that opened right after one of our hits is knockback, not the
        // opponent running away, and it closes again on its own.
        if (d > reach && s.ourHitWithin(10)) {
            double expected = kb.separationGain(s.lastHitWasSprint);
            this.rationale = String.format("gap %.2f after hit (expect %.2f)", d, expected);
            return SpacingZone.KNOCKBACK_GAP;
        }

        // Advancing into a swing that is already in flight is the one case
        // where closing is worse than holding.
        if (d <= reach + ENTERING_MARGIN && s.targetSwinging && s.targetSwingAgeTicks >= 0
                && s.targetSwingAgeTicks <= 3 && s.targetFacingDot > 0.6D
                && (s.closingSpeed > STABLE_CLOSING || predicted < danger)) {
            this.rationale = String.format("their swing %dt old at %.2f", s.targetSwingAgeTicks, d);
            return SpacingZone.WALK_IN_RISK;
        }

        if (d < danger) {
            this.rationale = String.format("%.2f < danger %.2f", d, danger);
            return SpacingZone.DANGER_CLOSE;
        }
        if (d <= reach) {
            // Inside range, but if the projection says we are about to be on
            // top of them, report the tighter band so the controller eases off
            // before it has to correct hard.
            if (predicted < danger && s.closingSpeed > STABLE_CLOSING) {
                this.rationale = String.format("%.2f now, %.2f in %dt", d, predicted, cfg.predictionTicks());
                return SpacingZone.DANGER_CLOSE;
            }
            this.rationale = String.format("%.2f in band %.2f-%.2f", d, danger, reach);
            return SpacingZone.COMBO_BAND;
        }
        if (d <= reach + ENTERING_MARGIN || predicted <= reach) {
            this.rationale = String.format("%.2f, reach %.2f in %dt", d, reach, ticksToRange(s, cfg));
            return SpacingZone.ENTERING;
        }
        this.rationale = String.format("%.2f beyond reach %.2f", d, reach);
        return SpacingZone.OUT_OF_RANGE;
    }

    /**
     * Ticks until the gap reaches effective range at the current closing speed.
     * Returns -1 when we are not closing (or already in range).
     */
    public int ticksToRange(CombatSnapshot s, CoreSettings cfg) {
        if (!s.hasTarget || s.closingSpeed <= STABLE_CLOSING) {
            return -1;
        }
        double deficit = s.distance - cfg.effectiveRange();
        if (deficit <= 0.0D) {
            return 0;
        }
        return (int) Math.ceil(deficit / s.closingSpeed);
    }

    /**
     * Ticks of backward movement needed to get from the current distance back
     * into the combo band, accounting for the opponent still closing.
     */
    public static int ticksToRecoverBand(CombatSnapshot s, CoreSettings cfg, double ourBackSpeed) {
        double deficit = cfg.comboBandDistance() - s.distance;
        if (deficit <= 0.0D) {
            return 0;
        }
        double rate = ourBackSpeed - Math.max(0.0D, s.targetClosingComponent);
        if (rate < 0.02D) {
            // They close faster than we can back off: backing up will not fix
            // the spacing, so report that no bounded tap achieves it.
            return -1;
        }
        return (int) Math.ceil(deficit / rate);
    }

    /** Why the last classification came out the way it did. */
    public String rationale() {
        return this.rationale;
    }
}
