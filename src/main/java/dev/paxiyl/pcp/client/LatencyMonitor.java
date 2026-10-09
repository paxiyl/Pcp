package dev.paxiyl.pcp.client;

import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.LatencyModel;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.network.NetHandlerPlayClient;
import net.minecraft.client.network.NetworkPlayerInfo;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.entity.player.EntityPlayer;

/**
 * Feeds the latency model from the only latency data the client genuinely has.
 *
 * <p><b>Measured.</b> The server publishes a round-trip time per player in the
 * player-list packet, which the client stores on {@code NetworkPlayerInfo}.
 * Reading our own entry is a real measurement (refreshed roughly once a
 * second). Reading an opponent's entry is also a real, server-reported value -
 * when the server chooses to publish it.</p>
 *
 * <p><b>Estimated.</b> If an opponent's entry is absent, zero or implausible
 * (hidden or faked, which is common), no number is invented. The model falls
 * back to an estimate derived from how far apart their position updates
 * arrive, carried with its own confidence and labelled as an estimate
 * everywhere it is shown.</p>
 */
public final class LatencyMonitor {

    /** Player-list ping only refreshes about once a second; poll at that rate. */
    private static final int POLL_INTERVAL_TICKS = 20;

    private final LatencyModel model;
    private long lastPollTick = Long.MIN_VALUE;
    private boolean opponentExposedLastPoll;

    public LatencyMonitor(LatencyModel model) {
        this.model = model;
    }

    public void update(Minecraft mc, EntityLivingBase target, int targetUpdateGapTicks,
                       CombatSnapshot snapshot, long tick) {
        if (targetUpdateGapTicks > 0) {
            this.model.recordOpponentUpdateGap(targetUpdateGapTicks);
        }

        if (tick - this.lastPollTick >= POLL_INTERVAL_TICKS) {
            this.lastPollTick = tick;
            poll(mc, target, tick);
        }

        snapshot.pingTicks = this.model.ownPingTicks();
        snapshot.latencyUncertaintyTicks = this.model.uncertaintyTicks();
        snapshot.latencyReliable = !this.model.unreliable(tick);
    }

    private void poll(Minecraft mc, EntityLivingBase target, long tick) {
        EntityPlayerSP me = mc.thePlayer;
        NetHandlerPlayClient net = mc.getNetHandler();
        if (me == null || net == null) {
            return;
        }

        NetworkPlayerInfo mine = net.getPlayerInfo(me.getUniqueID());
        if (mine != null) {
            this.model.recordOwnPing(mine.getResponseTime(), tick);
        }

        if (target instanceof EntityPlayer) {
            NetworkPlayerInfo theirs = net.getPlayerInfo(target.getUniqueID());
            if (theirs != null) {
                this.opponentExposedLastPoll = this.model.recordOpponentPing(theirs.getResponseTime());
            } else {
                this.opponentExposedLastPoll = false;
            }
        } else {
            this.opponentExposedLastPoll = false;
        }
    }

    /** True when the last poll found a usable server-reported opponent ping. */
    public boolean opponentPingExposed() {
        return this.opponentExposedLastPoll;
    }

    public void onTargetChanged() {
        this.model.clearOpponent();
        this.opponentExposedLastPoll = false;
    }

    public void onDisconnect() {
        this.model.reset();
        this.lastPollTick = Long.MIN_VALUE;
    }
}
