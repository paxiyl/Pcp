package dev.paxiyl.pcp.client;

import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.MoveAction;
import dev.paxiyl.pcp.core.MovementPlan;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.util.MovementInput;

/**
 * Executes at most one movement action at a time.
 *
 * <p>Single ownership is the whole point: W-tap and S-tap both want the forward
 * axis, so they go through one slot here with a duration counter. A running
 * action is never pre-empted by a new one, every action is bounded by
 * {@link CoreSettings#maxTapTicks()}, and {@link #releaseAll(String)} restores
 * the player's input immediately from anywhere - a failed state transition, a
 * menu opening, focus loss, death, or the mod being switched off.</p>
 */
public final class MovementController {

    private final CoreSettings settings;

    private AdaptiveMovementInput installed;

    private MoveAction active = MoveAction.NONE;
    private int remainingTicks;
    private long actionStartTick = -1L;
    private String activeReason = "-";

    // The player's real input, captured from the delegate every tick.
    private float playerForward;
    private float playerStrafe;
    private boolean playerSneak;

    private int actionsRun;
    private String lastRelease = "-";

    public MovementController(CoreSettings settings) {
        this.settings = settings;
    }

    // ------------------------------------------------------------------
    // Installation
    // ------------------------------------------------------------------

    /**
     * Installs the wrapper if it is not already in place. Safe to call every
     * tick; also re-installs after a respawn or world change, when Minecraft
     * builds a fresh player with a fresh input object.
     */
    public void install(EntityPlayerSP player) {
        if (player == null) {
            return;
        }
        MovementInput current = player.movementInput;
        if (current instanceof AdaptiveMovementInput) {
            this.installed = (AdaptiveMovementInput) current;
            return;
        }
        if (current == null) {
            return;
        }
        this.installed = new AdaptiveMovementInput(current, this);
        player.movementInput = this.installed;
    }

    /**
     * Removes the wrapper and hands the original input object back. Only
     * un-installs a wrapper that is still ours, so a later wrapper from another
     * mod is left alone.
     */
    public void uninstall(EntityPlayerSP player) {
        releaseAll("uninstall");
        if (player == null || this.installed == null) {
            this.installed = null;
            return;
        }
        if (player.movementInput == this.installed) {
            player.movementInput = this.installed.delegate();
        }
        this.installed = null;
    }

    public boolean installed() {
        return this.installed != null;
    }

    // ------------------------------------------------------------------
    // Per-tick execution
    // ------------------------------------------------------------------

    /**
     * Starts the planned action if nothing is running, otherwise counts the
     * running one down.
     *
     * @return true when an action started this tick
     */
    public boolean apply(MovementPlan plan, long tick) {
        if (this.active != MoveAction.NONE) {
            this.remainingTicks--;
            if (this.remainingTicks <= 0) {
                release("completed");
            }
            return false;
        }
        if (plan == null || !plan.isActive()) {
            return false;
        }
        int duration = (int) Math.max(this.settings.minTapTicks(),
                Math.min(this.settings.maxTapTicks(), plan.durationTicks));
        this.active = plan.action;
        this.remainingTicks = duration;
        this.actionStartTick = tick;
        this.activeReason = plan.reason;
        this.actionsRun++;
        return true;
    }

    /**
     * The forward-axis override, or {@link Float#NaN} to leave the player's
     * input alone.
     */
    public float forwardOverride() {
        switch (this.active) {
            case W_TAP:
            case HOLD:
                // Stop asking for forward. Vanilla drops the sprint and re-arms
                // it by itself once the player's input comes back through.
                return 0.0F;
            case S_TAP:
                return -1.0F;
            case NONE:
            default:
                return Float.NaN;
        }
    }

    void recordPlayerIntent(float forward, float strafe, boolean sneak) {
        this.playerForward = forward;
        this.playerStrafe = strafe;
        this.playerSneak = sneak;
    }

    /** Writes the player's real movement intent into the snapshot. */
    public void fillSnapshot(CombatSnapshot snapshot) {
        snapshot.selfForwardInput = this.playerForward;
        snapshot.selfStrafeInput = this.playerStrafe;
    }

    public boolean playerSneaking() {
        return this.playerSneak;
    }

    /**
     * Drops any running action at once. The next movement update sees no
     * override and the player is back in direct control.
     */
    public void releaseAll(String why) {
        if (this.active != MoveAction.NONE) {
            release(why);
        }
    }

    private void release(String why) {
        this.lastRelease = this.active.label() + " -> " + why;
        this.active = MoveAction.NONE;
        this.remainingTicks = 0;
        this.actionStartTick = -1L;
        this.activeReason = "-";
    }

    // ------------------------------------------------------------------
    // Introspection for the overlay
    // ------------------------------------------------------------------

    public MoveAction activeAction() {
        return this.active;
    }

    public int remainingTicks() {
        return this.remainingTicks;
    }

    public String activeReason() {
        return this.activeReason;
    }

    public long actionStartTick() {
        return this.actionStartTick;
    }

    public int actionsRun() {
        return this.actionsRun;
    }

    public String lastRelease() {
        return this.lastRelease;
    }

    /**
     * True when the wrapper is installed on the current player. Used by the
     * safety guard to notice a player swap (respawn, world change) that would
     * leave a stale wrapper behind.
     */
    public boolean matchesPlayer(Minecraft mc) {
        return mc != null && mc.thePlayer != null && mc.thePlayer.movementInput == this.installed;
    }
}
