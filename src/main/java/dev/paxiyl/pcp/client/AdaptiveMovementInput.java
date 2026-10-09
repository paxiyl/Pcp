package dev.paxiyl.pcp.client;

import net.minecraft.util.MovementInput;

/**
 * Transparent wrapper around the player's own {@link MovementInput}.
 *
 * <p>This is the only place the mod touches movement. Rather than forcing key
 * states - which fights with the player, with other mods, and with touch
 * controls such as PojavLauncher's - the real input object is kept and
 * delegated to, its result is recorded as the player's true intent, and an
 * override is applied on top only while an action is running. Dropping the
 * override restores the player's input on the very next tick, with nothing to
 * clean up.</p>
 *
 * <p>Sprint handling is left entirely to vanilla: 1.8.9 re-arms a sprint when
 * forward input returns above its threshold, so a W-tap only has to stop asking
 * for forward and let the game's own logic do the rest.</p>
 */
public class AdaptiveMovementInput extends MovementInput {

    private final MovementInput delegate;
    private final MovementController controller;

    public AdaptiveMovementInput(MovementInput delegate, MovementController controller) {
        this.delegate = delegate;
        this.controller = controller;
    }

    @Override
    public void updatePlayerMoveState() {
        this.delegate.updatePlayerMoveState();

        // Pass everything through untouched first.
        this.moveStrafe = this.delegate.moveStrafe;
        this.moveForward = this.delegate.moveForward;
        this.jump = this.delegate.jump;
        this.sneak = this.delegate.sneak;

        // The delegate's values are the player's real intent; the snapshot and
        // every gating rule are built from these, not from our output.
        this.controller.recordPlayerIntent(this.delegate.moveForward, this.delegate.moveStrafe, this.delegate.sneak);

        float override = this.controller.forwardOverride();
        if (!Float.isNaN(override)) {
            // Vanilla scales movement by 0.3 while sneaking; mirror that so an
            // override cannot move the player faster than their own input could.
            this.moveForward = this.sneak ? override * 0.3F : override;
        }
    }

    /** The input object this wrapper was installed over. */
    public MovementInput delegate() {
        return this.delegate;
    }
}
