package dev.paxiyl.pcp.client;

import dev.paxiyl.pcp.core.CombatBrain;
import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.TradeAdvice;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.client.settings.KeyBinding;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.util.MovingObjectPosition;

/**
 * Releases the player's attack at the tick the trade module picks.
 *
 * <p><b>It is a gate, not a clicker.</b> One click in produces at most one
 * attack out. Nothing is ever generated that the player did not ask for, and
 * nothing is ever dropped: the hold is capped by
 * {@link CoreSettings#maxTradeDelayTicks()} and expiry, an unsafe condition, a
 * new click or a lost target all release it immediately.</p>
 *
 * <p><b>Why this works on 1.8.9.</b> Inside {@code Minecraft.runTick()} Forge
 * fires its input events (mouse at bytecode offset 623, keyboard at 1439)
 * before the vanilla loop that drains {@code keyBindAttack.isPressed()} and
 * calls {@code clickMouse()} (offset 1798). Taking the queued press in an input
 * handler therefore happens strictly before vanilla would act on it, and
 * re-issuing it in the same handler attacks on the same tick with no added
 * latency. The release path is the ordinary client attack path -
 * {@code swingItem()} then {@code PlayerControllerMP.attackEntity} - which is
 * exactly what {@code clickMouse()} does for an entity.</p>
 *
 * <p>Clicks are only intercepted while the crosshair is on a living entity, so
 * block breaking, item use and GUI clicks are never touched.</p>
 */
public final class AttackGate {

    /** Hard ceiling on held attacks, independent of config. */
    private static final int MAX_PENDING = 1;
    /** Extra slack past effective range before a held attack is dropped. */
    private static final double RELEASE_RANGE_SLACK = 1.5D;

    private final CoreSettings settings;
    private final CombatBrain brain;
    private final HitObserver hits;

    private int pending;
    private long releaseAtTick;
    private EntityLivingBase pendingTarget;
    private String pendingReason = "-";

    private boolean manualOverrideHeld;
    private int heldCount;
    private int firedCount;
    private String lastDecision = "-";

    public AttackGate(CoreSettings settings, CombatBrain brain, HitObserver hits) {
        this.settings = settings;
        this.brain = brain;
        this.hits = hits;
    }

    public void setManualOverrideHeld(boolean held) {
        this.manualOverrideHeld = held;
    }

    public boolean manualOverrideHeld() {
        return this.manualOverrideHeld;
    }

    /**
     * Runs from the Forge mouse and keyboard input events, i.e. before vanilla
     * consumes the queued press.
     */
    public void onInputEvent(Minecraft mc, CombatSnapshot snapshot, long tick, boolean safe) {
        if (!this.settings.masterEnabled || !safe || mc == null || mc.thePlayer == null) {
            return;
        }
        if (mc.currentScreen != null || !mc.inGameHasFocus) {
            return;
        }

        EntityLivingBase entity = crosshairLiving(mc);
        if (entity == null) {
            // Not an entity attack: leave the input queue exactly as it is.
            return;
        }

        KeyBinding attack = mc.gameSettings.keyBindAttack;
        int drained = 0;
        while (attack.isPressed()) {
            drained++;
            if (drained > 8) {
                break;
            }
        }
        if (drained == 0) {
            return;
        }

        // One click, one attack: anything already held goes out now.
        if (this.pending > 0) {
            fire(mc, tick, "superseded by a new click");
        }
        // Extra clicks from the same tick are sent straight through.
        for (int i = 1; i < drained; i++) {
            send(mc, entity, tick);
        }

        refreshForDecision(mc, entity, snapshot);
        TradeAdvice advice = this.brain.adviseAttack(snapshot, this.manualOverrideHeld);
        this.lastDecision = advice.toString();

        int delay = Math.min(advice.delayTicks, this.settings.maxTradeDelayTicks());
        if (!advice.holds() || delay <= 0) {
            send(mc, entity, tick);
            return;
        }

        this.pending = MAX_PENDING;
        this.pendingTarget = entity;
        this.releaseAtTick = tick + delay;
        this.pendingReason = advice.reason;
        this.heldCount++;
    }

    /** Per-tick deadline and safety handling for a held attack. */
    public void tick(Minecraft mc, long tick, boolean safe) {
        if (this.pending <= 0) {
            return;
        }
        if (!safe) {
            fire(mc, tick, "released: automation stopped");
            return;
        }
        if (tick >= this.releaseAtTick) {
            fire(mc, tick, "released: window reached");
        }
    }

    /** Releases anything held right now, for toggles, disconnects and resets. */
    public void flush(Minecraft mc, long tick, String why) {
        if (this.pending > 0) {
            fire(mc, tick, why);
        }
    }

    /** Drops a held attack without sending it. Only for a lost world/player. */
    public void discard(String why) {
        this.pending = 0;
        this.pendingTarget = null;
        this.pendingReason = why;
    }

    private void fire(Minecraft mc, long tick, String why) {
        EntityLivingBase target = this.pendingTarget;
        this.pending = 0;
        this.pendingTarget = null;
        this.pendingReason = why;
        if (mc == null || mc.thePlayer == null) {
            return;
        }
        send(mc, target, tick);
    }

    /**
     * The ordinary client attack path. Mirrors the entity branch of
     * {@code Minecraft.clickMouse()}.
     */
    private void send(Minecraft mc, EntityLivingBase target, long tick) {
        EntityPlayerSP me = mc.thePlayer;
        if (me == null) {
            return;
        }
        boolean valid = target != null && !target.isDead && target.isEntityAlive()
                && target.worldObj == me.worldObj
                && me.getDistanceToEntity(target) <= this.settings.effectiveRange() + RELEASE_RANGE_SLACK;

        boolean sprinting = me.isSprinting();
        double distance = target == null ? -1.0D : me.getDistanceToEntity(target);

        me.swingItem();
        if (valid) {
            mc.playerController.attackEntity(me, target);
            this.hits.onAttackSent(target, sprinting, distance, tick);
        }
        this.firedCount++;
    }

    /**
     * Refreshes the few fields that matter most for the decision, since the
     * snapshot was built at the end of the previous tick.
     */
    private void refreshForDecision(Minecraft mc, EntityLivingBase entity, CombatSnapshot snapshot) {
        EntityPlayerSP me = mc.thePlayer;
        if (me == null || entity == null) {
            return;
        }
        snapshot.hasTarget = true;
        snapshot.distance = me.getDistanceToEntity(entity);
        snapshot.selfSprinting = me.isSprinting();
        snapshot.selfHurtTime = me.hurtTime;
        snapshot.attackKeyHeld = mc.gameSettings.keyBindAttack.isKeyDown();
    }

    private EntityLivingBase crosshairLiving(Minecraft mc) {
        MovingObjectPosition hit = mc.objectMouseOver;
        if (hit == null || hit.typeOfHit != MovingObjectPosition.MovingObjectType.ENTITY) {
            return null;
        }
        Entity entity = hit.entityHit;
        if (!(entity instanceof EntityLivingBase) || entity == mc.thePlayer) {
            return null;
        }
        return (EntityLivingBase) entity;
    }

    public boolean holding() {
        return this.pending > 0;
    }

    public int pendingTicks(long tick) {
        return this.pending > 0 ? (int) Math.max(0L, this.releaseAtTick - tick) : 0;
    }

    public String pendingReason() {
        return this.pendingReason;
    }

    public String lastDecision() {
        return this.lastDecision;
    }

    public int heldCount() {
        return this.heldCount;
    }

    public int firedCount() {
        return this.firedCount;
    }
}
