package dev.paxiyl.pcp.client;

import dev.paxiyl.pcp.core.CombatBrain;
import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.KnockbackObservation;
import net.minecraft.client.entity.EntityPlayerSP;
import net.minecraft.entity.EntityLivingBase;

/**
 * Watches hits and turns them into knockback observations.
 *
 * <p><b>What counts as evidence.</b> The client is never told "your hit
 * landed". What it does get is the victim's hurt animation timer, their synced
 * health, and the velocity the server applied to them. A rising hurt timer (or
 * a health drop) on the entity we just attacked, inside a short window, is
 * treated as a connected hit.</p>
 *
 * <p><b>Known ambiguity.</b> A third party hitting the same opponent in that
 * window looks identical from here. Nothing in the client can separate the two,
 * so instead of pretending otherwise the profile keeps rolling samples with a
 * confidence number and discards runs that do not fit
 * ({@code KnockbackProfile} handles that), and this class attributes a hit only
 * when we actually attacked that specific entity moments earlier.</p>
 */
public final class HitObserver {

    /** Ticks after our attack in which a reaction still counts as ours. */
    private static final int CONFIRM_WINDOW = 6;
    /** Ticks over which displacement is measured once a hit is confirmed. */
    private static final int MEASURE_TICKS = 4;
    /** Window used for the "recent exchange" counters. */
    private static final int RECENT_WINDOW = 60;
    private static final int RING = 16;

    // --- our attack, awaiting confirmation ---
    private long attackTick = -1L;
    private int attackTargetId = -1;
    private boolean attackSprinting;
    private double attackDistance = -1.0D;

    // --- confirmed hits ---
    private long ourHitTick = -1L;
    private boolean ourHitWasSprint;
    private long hitTakenTick = -1L;

    // --- target state tracking ---
    private int targetId = -1;
    private int lastTargetHurtTime;
    private float lastTargetHealth = -1.0F;
    private boolean targetSeeded;

    // --- our own state tracking ---
    private int lastSelfHurtTime;
    private float lastSelfHealth = -1.0F;
    private boolean selfSeeded;

    // --- outgoing measurement in flight ---
    private boolean measuringOut;
    private long outStartTick;
    private double outStartX;
    private double outStartZ;
    private double outPeakMotionY;
    private int outReactionTicks;

    // --- incoming measurement in flight ---
    private boolean measuringIn;
    private long inStartTick;
    private double inStartX;
    private double inStartZ;
    private double inStartDistance;
    private double inPeakMotionY;
    private boolean inAttackerSprinting;

    private final long[] landed = new long[RING];
    private final long[] taken = new long[RING];
    private int landedIdx;
    private int takenIdx;

    private int confirmedHits;
    private int unconfirmedAttacks;

    /** Called by the attack gate the moment an attack is actually sent. */
    public void onAttackSent(EntityLivingBase target, boolean sprinting, double distance, long tick) {
        if (this.attackTick >= 0L) {
            this.unconfirmedAttacks++;
        }
        this.attackTick = tick;
        this.attackTargetId = target == null ? -1 : target.getEntityId();
        this.attackSprinting = sprinting;
        this.attackDistance = distance;
    }

    public void reset(String why) {
        this.attackTick = -1L;
        this.attackTargetId = -1;
        this.attackDistance = -1.0D;
        this.ourHitTick = -1L;
        this.hitTakenTick = -1L;
        this.measuringOut = false;
        this.measuringIn = false;
        this.targetSeeded = false;
        this.selfSeeded = false;
        this.targetId = -1;
        this.lastTargetHealth = -1.0F;
        this.lastSelfHealth = -1.0F;
    }

    /**
     * Runs once per tick after entities have ticked, so hurt timers and applied
     * velocities for this tick are already visible.
     */
    public void update(EntityPlayerSP me, EntityLivingBase target, CombatBrain brain,
                       CombatSnapshot snapshot, long tick) {
        if (me == null) {
            return;
        }

        trackIncoming(me, target, brain, tick);

        if (target == null) {
            if (this.measuringOut) {
                // Opponent vanished mid-measurement: the sample would be
                // meaningless, so drop it rather than record a guess.
                this.measuringOut = false;
            }
            this.targetSeeded = false;
            this.targetId = -1;
            fill(snapshot, tick);
            return;
        }

        if (target.getEntityId() != this.targetId) {
            this.targetId = target.getEntityId();
            this.targetSeeded = false;
            this.measuringOut = false;
        }

        if (!this.targetSeeded) {
            this.lastTargetHurtTime = target.hurtTime;
            this.lastTargetHealth = target.getHealth();
            this.targetSeeded = true;
            fill(snapshot, tick);
            return;
        }

        boolean hurtRose = target.hurtTime > this.lastTargetHurtTime;
        boolean healthDropped = target.getHealth() < this.lastTargetHealth - 1.0E-4F;
        this.lastTargetHurtTime = target.hurtTime;
        this.lastTargetHealth = target.getHealth();

        // Confirmation of our own attack.
        if (this.attackTick >= 0L && target.getEntityId() == this.attackTargetId) {
            if (tick - this.attackTick > CONFIRM_WINDOW) {
                this.attackTick = -1L;
                this.unconfirmedAttacks++;
            } else if (hurtRose || healthDropped) {
                this.ourHitTick = tick;
                this.ourHitWasSprint = this.attackSprinting;
                this.outReactionTicks = (int) (tick - this.attackTick);
                this.confirmedHits++;
                this.landed[this.landedIdx] = tick;
                this.landedIdx = (this.landedIdx + 1) % RING;

                this.measuringOut = true;
                this.outStartTick = tick;
                this.outStartX = target.posX;
                this.outStartZ = target.posZ;
                this.outPeakMotionY = target.motionY;
                brain.latency().recordHitResponse(this.outReactionTicks);
                this.attackTick = -1L;
            }
        }

        if (this.measuringOut) {
            if (target.motionY > this.outPeakMotionY) {
                this.outPeakMotionY = target.motionY;
            }
            if (tick - this.outStartTick >= MEASURE_TICKS) {
                double dx = target.posX - this.outStartX;
                double dz = target.posZ - this.outStartZ;
                double horizontal = Math.sqrt(dx * dx + dz * dz);
                double separation = this.attackDistance > 0.0D
                        ? me.getDistanceToEntity(target) - this.attackDistance
                        : 0.0D;
                brain.recordKnockback(new KnockbackObservation(horizontal, this.outPeakMotionY,
                        Math.max(0.0D, separation), this.ourHitWasSprint, this.outReactionTicks, true));
                this.measuringOut = false;
            }
        }

        fill(snapshot, tick);
    }

    /** Knockback we take, measured the same way from our own displacement. */
    private void trackIncoming(EntityPlayerSP me, EntityLivingBase target, CombatBrain brain, long tick) {
        if (!this.selfSeeded) {
            this.lastSelfHurtTime = me.hurtTime;
            this.lastSelfHealth = me.getHealth();
            this.selfSeeded = true;
            return;
        }
        boolean hurtRose = me.hurtTime > this.lastSelfHurtTime;
        boolean healthDropped = me.getHealth() < this.lastSelfHealth - 1.0E-4F;
        this.lastSelfHurtTime = me.hurtTime;
        this.lastSelfHealth = me.getHealth();

        if (hurtRose || healthDropped) {
            // Always record the hit itself, even if a measurement from the
            // previous one is still running: the exchange counters and the
            // recovery state must not miss hits during a fast combo.
            this.hitTakenTick = tick;
            this.taken[this.takenIdx] = tick;
            this.takenIdx = (this.takenIdx + 1) % RING;
            if (!this.measuringIn) {
                this.measuringIn = true;
                this.inStartTick = tick;
                this.inStartX = me.posX;
                this.inStartZ = me.posZ;
                this.inPeakMotionY = me.motionY;
                this.inStartDistance = target == null ? -1.0D : me.getDistanceToEntity(target);
                // Attribution assumption: if we have an opponent, their sprint
                // state is the best available guess at what kind of hit that was.
                this.inAttackerSprinting = target != null && target.isSprinting();
            }
        }
        if (this.measuringIn) {
            if (me.motionY > this.inPeakMotionY) {
                this.inPeakMotionY = me.motionY;
            }
            if (tick - this.inStartTick >= MEASURE_TICKS) {
                double dx = me.posX - this.inStartX;
                double dz = me.posZ - this.inStartZ;
                double horizontal = Math.sqrt(dx * dx + dz * dz);
                double separation = (target != null && this.inStartDistance > 0.0D)
                        ? me.getDistanceToEntity(target) - this.inStartDistance
                        : 0.0D;
                brain.recordKnockback(new KnockbackObservation(horizontal, this.inPeakMotionY,
                        Math.max(0.0D, separation), this.inAttackerSprinting, -1, false));
                this.measuringIn = false;
            }
        }
    }

    private void fill(CombatSnapshot s, long tick) {
        s.ticksSinceOurHit = this.ourHitTick < 0L ? -1 : (int) (tick - this.ourHitTick);
        s.ticksSinceOurAttack = this.attackTick < 0L ? -1 : (int) (tick - this.attackTick);
        s.ticksSinceHitTaken = this.hitTakenTick < 0L ? -1 : (int) (tick - this.hitTakenTick);
        s.lastHitWasSprint = this.ourHitWasSprint;
        s.recentHitsLanded = countRecent(this.landed, tick);
        s.recentHitsTaken = countRecent(this.taken, tick);
    }

    private static int countRecent(long[] ring, long tick) {
        int n = 0;
        for (int i = 0; i < ring.length; i++) {
            if (ring[i] > 0L && tick - ring[i] <= RECENT_WINDOW) {
                n++;
            }
        }
        return n;
    }

    public int confirmedHits() {
        return this.confirmedHits;
    }

    public int unconfirmedAttacks() {
        return this.unconfirmedAttacks;
    }

    public boolean awaitingConfirmation() {
        return this.attackTick >= 0L;
    }
}
