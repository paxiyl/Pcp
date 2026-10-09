package dev.paxiyl.pcp.client;

import java.util.List;

import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.RollingStats;
import net.minecraft.client.Minecraft;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityLivingBase;
import net.minecraft.entity.player.EntityPlayer;
import net.minecraft.util.MovingObjectPosition;
import net.minecraft.util.Vec3;

/**
 * Picks the current opponent and measures the geometry of the engagement.
 *
 * <p>Preference order: whatever the crosshair is on, then the existing target
 * while it stays valid, then the nearest plausible opponent in front of us.
 * The fallback scan is throttled and only walks the world's player list, which
 * is short, so the per-tick cost stays flat - this has to stay cheap on phones
 * running PojavLauncher as well as on desktops.</p>
 *
 * <p>Velocities come from position deltas rather than {@code motionX/Y/Z},
 * because for other players the motion fields are only populated when the
 * server sends an explicit velocity packet, while position deltas reflect what
 * actually happened.</p>
 */
public final class TargetTracker {

    private static final int SCAN_INTERVAL_TICKS = 4;
    /** Opponents outside this cone are not treated as the current engagement. */
    private static final double SCAN_CONE_DOT = 0.25D;

    private final CoreSettings settings;
    private final RollingStats closing = new RollingStats(4, 0.5D);

    private EntityLivingBase target;
    private int targetId = -1;
    private long lastSeenTick = -1L;
    private long lastScanTick = -1L;

    private double lastDistance = -1.0D;
    private double targetLastX;
    private double targetLastY;
    private double targetLastZ;
    private boolean targetPosSeeded;

    private boolean lastSwinging;
    private long swingStartTick = -1L;
    private long lastMoveTick = -1L;
    private int lastUpdateGapTicks = -1;

    public TargetTracker(CoreSettings settings) {
        this.settings = settings;
    }

    public EntityLivingBase target() {
        return this.target;
    }

    public boolean hasTarget() {
        return this.target != null;
    }

    /** Ticks since the last position change of the target, for latency estimation. */
    public int lastUpdateGapTicks() {
        return this.lastUpdateGapTicks;
    }

    public void clear(String why) {
        this.target = null;
        this.targetId = -1;
        this.lastDistance = -1.0D;
        this.targetPosSeeded = false;
        this.closing.clear();
        this.lastSwinging = false;
        this.swingStartTick = -1L;
        this.lastUpdateGapTicks = -1;
        this.lastMoveTick = -1L;
    }

    /**
     * Re-evaluates the target and writes the engagement geometry into the
     * snapshot.
     */
    public void update(Minecraft mc, CombatSnapshot snapshot, long tick, boolean playersOnly) {
        EntityPlayerSP me = mc.thePlayer;
        if (me == null || mc.theWorld == null) {
            clear("no world");
            return;
        }

        EntityLivingBase chosen = fromCrosshair(mc, me, playersOnly);
        if (chosen == null && isValid(this.target, me, playersOnly)
                && tick - this.lastSeenTick <= this.settings.targetTimeoutTicks()) {
            chosen = this.target;
        }
        if (chosen == null && tick - this.lastScanTick >= SCAN_INTERVAL_TICKS) {
            this.lastScanTick = tick;
            chosen = scanNearest(mc, me, playersOnly);
        }

        if (chosen == null) {
            if (this.target != null && tick - this.lastSeenTick > this.settings.targetTimeoutTicks()) {
                clear("target timed out");
            }
            snapshot.hasTarget = false;
            return;
        }

        if (chosen.getEntityId() != this.targetId) {
            // New opponent: history from the old one would be misleading.
            clear("new target");
            this.target = chosen;
            this.targetId = chosen.getEntityId();
        } else {
            this.target = chosen;
        }
        this.lastSeenTick = tick;

        measure(me, chosen, snapshot, tick);
    }

    private void measure(EntityPlayerSP me, EntityLivingBase t, CombatSnapshot s, long tick) {
        double distance = me.getDistanceToEntity(t);

        if (this.lastDistance >= 0.0D) {
            this.closing.push(this.lastDistance - distance);
        }
        this.lastDistance = distance;

        double vx = 0.0D;
        double vy = 0.0D;
        double vz = 0.0D;
        if (this.targetPosSeeded) {
            vx = t.posX - this.targetLastX;
            vy = t.posY - this.targetLastY;
            vz = t.posZ - this.targetLastZ;
        }
        boolean moved = Math.abs(vx) > 1.0E-4D || Math.abs(vz) > 1.0E-4D || Math.abs(vy) > 1.0E-4D;
        if (moved) {
            if (this.lastMoveTick >= 0L) {
                this.lastUpdateGapTicks = (int) (tick - this.lastMoveTick);
            }
            this.lastMoveTick = tick;
        }
        this.targetLastX = t.posX;
        this.targetLastY = t.posY;
        this.targetLastZ = t.posZ;
        this.targetPosSeeded = true;

        // Unit vector from the target towards us, on the horizontal plane.
        double dx = me.posX - t.posX;
        double dz = me.posZ - t.posZ;
        double flat = Math.sqrt(dx * dx + dz * dz);
        double ux = flat > 1.0E-4D ? dx / flat : 0.0D;
        double uz = flat > 1.0E-4D ? dz / flat : 0.0D;

        // Swing tracking: the animation is server-driven, so this is real
        // evidence that the opponent has attacked, not a guess.
        boolean swinging = t.isSwingInProgress;
        if (swinging && !this.lastSwinging) {
            this.swingStartTick = tick;
        } else if (!swinging) {
            this.swingStartTick = -1L;
        }
        this.lastSwinging = swinging;

        Vec3 look = t.getLookVec();

        s.hasTarget = true;
        s.targetId = this.targetId;
        s.distance = distance;
        s.closingSpeed = this.closing.count() == 0 ? 0.0D : this.closing.ewma();
        s.targetSpeed = Math.sqrt(vx * vx + vz * vz);
        s.targetClosingComponent = vx * ux + vz * uz;
        s.targetFacingDot = look == null ? 0.0D : (look.xCoord * ux + look.zCoord * uz);
        s.targetHurtTime = t.hurtTime;
        s.targetSwinging = swinging;
        s.targetSwingAgeTicks = this.swingStartTick < 0L ? -1 : (int) (tick - this.swingStartTick);
    }

    private EntityLivingBase fromCrosshair(Minecraft mc, EntityPlayerSP me, boolean playersOnly) {
        MovingObjectPosition hit = mc.objectMouseOver;
        if (hit == null || hit.typeOfHit != MovingObjectPosition.MovingObjectType.ENTITY) {
            return null;
        }
        Entity entity = hit.entityHit;
        if (!(entity instanceof EntityLivingBase)) {
            return null;
        }
        EntityLivingBase living = (EntityLivingBase) entity;
        return isValid(living, me, playersOnly) ? living : null;
    }

    private EntityLivingBase scanNearest(Minecraft mc, EntityPlayerSP me, boolean playersOnly) {
        Vec3 look = me.getLookVec();
        double bestSq = this.settings.maxTargetDistance() * this.settings.maxTargetDistance();
        EntityLivingBase best = null;

        List<EntityPlayer> players = mc.theWorld.playerEntities;
        for (int i = 0; i < players.size(); i++) {
            EntityPlayer p = players.get(i);
            if (!isValid(p, me, playersOnly)) {
                continue;
            }
            double dSq = me.getDistanceSqToEntity(p);
            if (dSq > bestSq) {
                continue;
            }
            double dx = p.posX - me.posX;
            double dz = p.posZ - me.posZ;
            double flat = Math.sqrt(dx * dx + dz * dz);
            if (flat > 1.0E-4D && look != null) {
                double dot = (look.xCoord * dx + look.zCoord * dz) / flat;
                if (dot < SCAN_CONE_DOT) {
                    continue;
                }
            }
            bestSq = dSq;
            best = p;
        }
        // Note: the fallback scan only walks the player list, which is short
        // enough to stay cheap every few ticks. With targetPlayersOnly off, a
        // non-player opponent is still tracked - but only while the crosshair
        // is on it, rather than being searched for.
        return best;
    }

    /**
     * Null entity, dead entity, spectator, wrong world, ourselves, or simply
     * too far away: all reasons to stop treating something as an opponent.
     */
    private boolean isValid(EntityLivingBase candidate, EntityPlayerSP me, boolean playersOnly) {
        if (candidate == null || me == null) {
            return false;
        }
        if (candidate == me || candidate.getEntityId() == me.getEntityId()) {
            return false;
        }
        if (candidate.isDead || !candidate.isEntityAlive()) {
            return false;
        }
        if (candidate.worldObj != me.worldObj) {
            return false;
        }
        if (playersOnly && !(candidate instanceof EntityPlayer)) {
            return false;
        }
        if (candidate instanceof EntityPlayer && ((EntityPlayer) candidate).isSpectator()) {
            return false;
        }
        return me.getDistanceToEntity(candidate) <= this.settings.maxTargetDistance();
    }
}
