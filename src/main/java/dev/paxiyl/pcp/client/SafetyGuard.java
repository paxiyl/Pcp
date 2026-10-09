package dev.paxiyl.pcp.client;

import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.entity.player.EntityPlayer;

/**
 * One place that answers "may automation touch anything right now?".
 *
 * <p>Returns the reason it said no, so the overlay and the decision log can
 * show it. The caller releases every controlled input whenever this returns a
 * reason, which covers menus, focus loss, death, world changes, disconnects and
 * the player's own suspend key.</p>
 */
public final class SafetyGuard {

    private boolean suspendedByPlayer;
    private String lastBlockReason = "startup";

    /**
     * @return null when automation is allowed, otherwise the blocking reason
     */
    public String check(Minecraft mc) {
        String reason = evaluate(mc);
        this.lastBlockReason = reason == null ? null : reason;
        return reason;
    }

    private String evaluate(Minecraft mc) {
        if (mc == null) {
            return "no client";
        }
        if (mc.theWorld == null) {
            return "no world";
        }
        EntityPlayerSP player = mc.thePlayer;
        if (player == null) {
            return "no player";
        }
        if (player.isDead || !player.isEntityAlive()) {
            return "player dead";
        }
        if (((EntityPlayer) player).isSpectator()) {
            return "spectator";
        }
        if (mc.getNetHandler() == null) {
            return "no connection";
        }
        if (mc.currentScreen != null) {
            return "screen open";
        }
        if (!mc.inGameHasFocus) {
            return "window not focused";
        }
        if (mc.isGamePaused()) {
            return "game paused";
        }
        if (this.suspendedByPlayer) {
            return "suspended by player";
        }
        return null;
    }

    public void setSuspendedByPlayer(boolean suspended) {
        this.suspendedByPlayer = suspended;
    }

    public boolean suspendedByPlayer() {
        return this.suspendedByPlayer;
    }

    public String lastBlockReason() {
        return this.lastBlockReason == null ? "ok" : this.lastBlockReason;
    }
}
