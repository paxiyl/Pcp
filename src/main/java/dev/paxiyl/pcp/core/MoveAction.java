package dev.paxiyl.pcp.core;

/**
 * Movement outputs. Exactly one can be active at a time, which is what keeps
 * two modules from fighting over the same key.
 */
public enum MoveAction {

    /** Hands movement back to the player. */
    NONE("-"),
    /**
     * Release forward briefly. In 1.8.9 dropping forward input below the sprint
     * threshold for a tick and letting it return is what resets the sprint, so
     * the controller only has to stop asking for forward; the game re-sprints
     * through its own double-tap/sprint-key path.
     */
    W_TAP("W-tap"),
    /** Brief, bounded backward input to open a small amount of space. */
    S_TAP("S-tap"),
    /** Hold neutral: stop asking for forward without asking for back. */
    HOLD("hold");

    private final String label;

    MoveAction(String label) {
        this.label = label;
    }

    public String label() {
        return this.label;
    }
}
