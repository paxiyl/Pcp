package dev.paxiyl.pcp.core;

/** What the trade module wants to do with an attack the player has asked for. */
public enum TradeDecision {

    /** Send it now. */
    ATTACK_NOW("now"),
    /** Hold it for a bounded number of ticks, then send it. */
    DELAY("delay"),
    /** Fix spacing first; the attack is still released within the cap. */
    REPOSITION("reposition");

    private final String label;

    TradeDecision(String label) {
        this.label = label;
    }

    public String label() {
        return this.label;
    }
}
