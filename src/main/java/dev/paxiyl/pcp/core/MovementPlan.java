package dev.paxiyl.pcp.core;

/** One movement decision: what to do, for how long, and why. */
public final class MovementPlan {

    public MoveAction action = MoveAction.NONE;
    public int durationTicks;
    public String reason = "idle";
    /** Confidence that fed this decision, for the overlay. */
    public double confidence;

    public void set(MoveAction action, int durationTicks, String reason, double confidence) {
        this.action = action;
        this.durationTicks = durationTicks;
        this.reason = reason;
        this.confidence = confidence;
    }

    public void clear(String reason) {
        set(MoveAction.NONE, 0, reason, 0.0D);
    }

    public boolean isActive() {
        return this.action != MoveAction.NONE && this.durationTicks > 0;
    }

    @Override
    public String toString() {
        return this.action.label() + (this.durationTicks > 0 ? ("/" + this.durationTicks + "t") : "") + " (" + this.reason + ")";
    }
}
