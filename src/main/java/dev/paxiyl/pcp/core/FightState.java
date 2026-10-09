package dev.paxiyl.pcp.core;

/** The fight states the controller reasons about. */
public enum FightState {

    /** No valid opponent engagement. Automation is idle and inputs are released. */
    IDLE("Idle"),
    /** A valid target exists but is out of effective range; closing under control. */
    APPROACH("Approach"),
    /** Target is inside, or about to be inside, effective attack range. */
    ENGAGEMENT("Engage"),
    /** A hit landed and forward pressure is worth keeping. */
    COMBO("Combo"),
    /** Both players are close enough to hit each other and both are acting. */
    TRADE("Trade"),
    /** Re-establishing movement and spacing after taking knockback. */
    RECOVERY("Recover"),
    /** Backing out of a bad position on purpose. */
    DISENGAGE("Disengage");

    private final String label;

    FightState(String label) {
        this.label = label;
    }

    public String label() {
        return this.label;
    }

    /** States where movement automation may act at all. */
    public boolean allowsMovementAssist() {
        return this != IDLE;
    }
}
