package dev.paxiyl.pcp.core;

/**
 * Everything the decision core is allowed to know about one tick of a fight.
 *
 * <p>The client layer fills this in from Minecraft state and nothing in the
 * core touches Minecraft classes, which is what makes the logic testable
 * head-less. One instance is reused every tick to keep allocation off the hot
 * path.</p>
 *
 * <p>Distances are blocks, speeds are blocks per tick, and "closing" is
 * positive when the gap is shrinking.</p>
 */
public final class CombatSnapshot {

    public long tick;

    // --- target ---
    public boolean hasTarget;
    public int targetId = -1;
    public double distance;
    public double closingSpeed;
    public double targetSpeed;
    /** Component of the target's velocity pointed at us, blocks/tick. */
    public double targetClosingComponent;
    /** 1.0 when the target looks straight at us, 0 when side-on, negative when turned away. */
    public double targetFacingDot;
    public int targetHurtTime;
    /** True while the target's swing animation is playing: they have attacked. */
    public boolean targetSwinging;
    /** Ticks since the target's swing started, or -1. */
    public int targetSwingAgeTicks = -1;

    // --- us ---
    public boolean selfSprinting;
    public double selfSpeed;
    /** The player's own forward input, before any assistance (-1..1). */
    public double selfForwardInput;
    public double selfStrafeInput;
    public boolean selfOnGround;
    public int selfHurtTime;
    public boolean attackKeyHeld;

    // --- exchange history ---
    /** Ticks since one of our hits was confirmed, or -1. */
    public int ticksSinceOurHit = -1;
    /** Ticks since we sent an attack, or -1. */
    public int ticksSinceOurAttack = -1;
    /** Ticks since we took a hit, or -1. */
    public int ticksSinceHitTaken = -1;
    /** Whether we were sprinting when our last confirmed hit was sent. */
    public boolean lastHitWasSprint;
    public int recentHitsLanded;
    public int recentHitsTaken;

    // --- latency ---
    public double pingTicks = -1.0D;
    public double latencyUncertaintyTicks = 1.0D;
    public boolean latencyReliable;

    public void reset() {
        this.hasTarget = false;
        this.targetId = -1;
        this.distance = 0.0D;
        this.closingSpeed = 0.0D;
        this.targetSpeed = 0.0D;
        this.targetClosingComponent = 0.0D;
        this.targetFacingDot = 0.0D;
        this.targetHurtTime = 0;
        this.targetSwinging = false;
        this.targetSwingAgeTicks = -1;
        this.selfSprinting = false;
        this.selfSpeed = 0.0D;
        this.selfForwardInput = 0.0D;
        this.selfStrafeInput = 0.0D;
        this.selfOnGround = false;
        this.selfHurtTime = 0;
        this.attackKeyHeld = false;
        this.ticksSinceOurHit = -1;
        this.ticksSinceOurAttack = -1;
        this.ticksSinceHitTaken = -1;
        this.lastHitWasSprint = false;
        this.recentHitsLanded = 0;
        this.recentHitsTaken = 0;
        this.pingTicks = -1.0D;
        this.latencyUncertaintyTicks = 1.0D;
        this.latencyReliable = false;
    }

    /** True when {@code ticksSince*} is set and within {@code window} ticks. */
    public static boolean within(int ticksSince, int window) {
        return ticksSince >= 0 && ticksSince <= window;
    }

    public boolean ourHitWithin(int window) {
        return within(this.ticksSinceOurHit, window);
    }

    public boolean hitTakenWithin(int window) {
        return within(this.ticksSinceHitTaken, window);
    }

    /** The player is asking to move forward hard enough for 1.8.9 to sprint. */
    public boolean playerWantsForward() {
        return this.selfForwardInput >= 0.8D;
    }
}
