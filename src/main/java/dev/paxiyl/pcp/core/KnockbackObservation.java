package dev.paxiyl.pcp.core;

/**
 * One measured knockback event.
 *
 * <p>Every field here is derived from client-visible state only: entity
 * positions and motion the server already sent us, our own sprint flag, and the
 * hurt-animation timer. Nothing in this class is read from the server's
 * knockback configuration, because the client is never told what that is.</p>
 */
public final class KnockbackObservation {

    /** Horizontal distance the victim travelled while the knockback played out (blocks). */
    public final double horizontalDisplacement;
    /** Peak upward motion seen on the victim right after the hit (blocks/tick). */
    public final double verticalMotion;
    /** How much separation the hit created between the two players (blocks). */
    public final double separationGain;
    /** Whether the attacker was sprinting on the tick the hit was sent. */
    public final boolean sprintHit;
    /** Ticks between sending the attack and seeing the victim react. */
    public final int reactionTicks;
    /** True when we were the attacker, false when we were the victim. */
    public final boolean outgoing;

    public KnockbackObservation(double horizontalDisplacement, double verticalMotion, double separationGain,
                                boolean sprintHit, int reactionTicks, boolean outgoing) {
        this.horizontalDisplacement = horizontalDisplacement;
        this.verticalMotion = verticalMotion;
        this.separationGain = separationGain;
        this.sprintHit = sprintHit;
        this.reactionTicks = reactionTicks;
        this.outgoing = outgoing;
    }

    @Override
    public String toString() {
        return String.format("%s %s h=%.2f v=%.2f sep=%.2f react=%dt",
                this.outgoing ? "out" : "in", this.sprintHit ? "sprint" : "walk",
                this.horizontalDisplacement, this.verticalMotion, this.separationGain, this.reactionTicks);
    }
}
