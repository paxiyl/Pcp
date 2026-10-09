package dev.paxiyl.pcp.core;

/** The trade module's answer when the player asks to attack. */
public final class TradeAdvice {

    public TradeDecision decision = TradeDecision.ATTACK_NOW;
    public int delayTicks;
    public String reason = "pass-through";

    public void set(TradeDecision decision, int delayTicks, String reason) {
        this.decision = decision;
        this.delayTicks = delayTicks;
        this.reason = reason;
    }

    public boolean holds() {
        return this.decision != TradeDecision.ATTACK_NOW && this.delayTicks > 0;
    }

    @Override
    public String toString() {
        return this.decision.label() + (this.delayTicks > 0 ? ("+" + this.delayTicks + "t") : "") + " (" + this.reason + ")";
    }
}
