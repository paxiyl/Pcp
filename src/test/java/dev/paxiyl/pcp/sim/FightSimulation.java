package dev.paxiyl.pcp.sim;

import java.util.Random;

import dev.paxiyl.pcp.core.CombatBrain;
import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.KnockbackObservation;
import dev.paxiyl.pcp.core.MoveAction;
import dev.paxiyl.pcp.core.MovementPlan;

/**
 * A physical simulation of a 1.8.9 duel, used to calibrate the decision core.
 *
 * <p>Unit tests prove the logic does what it was told to do. This proves
 * something different and more important: that what it was told to do is
 * actually reachable in a real fight. It models two players on flat ground with
 * 1.8.9-like movement and knockback, runs the real {@link CombatBrain} as the
 * attacker, derives knockback observations exactly the way
 * {@code HitObserver} does, and reports what the system actually achieves -
 * how far confidence climbs, how often it clears its own gate, and how many
 * actions ever fire.</p>
 *
 * <p>The physics are approximate on purpose. What matters is the
 * <em>variability</em> an estimator has to cope with: strafing, jump hits,
 * misses, latency jitter and an opponent who is also moving. Those are what
 * decide whether a confidence metric ever converges, and they are exactly what
 * a hand-written unit test leaves out.</p>
 */
public final class FightSimulation {

    // --- 1.8.9-like constants ---
    /** Sprint speed, blocks/tick (5.612 m/s). */
    static final double SPRINT_SPEED = 0.2806D;
    /** Walk speed, blocks/tick (4.317 m/s). */
    static final double WALK_SPEED = 0.2158D;
    /** Base horizontal knockback impulse. */
    static final double KB_BASE = 0.40D;
    /** Extra horizontal impulse when the attacker is sprinting. */
    static final double KB_SPRINT_BONUS = 0.50D;
    /** Horizontal drag per tick while airborne. */
    static final double AIR_DRAG = 0.91D;
    /** Ground friction per tick. */
    static final double GROUND_DRAG = 0.60D;
    /** Player hitbox half-width. */
    static final double HALF_WIDTH = 0.30D;
    /** Entity collision border vanilla expands the hitbox by when picking. */
    static final double COLLISION_BORDER = 0.10D;
    /** Vanilla eye-to-hitbox pick range for entities. */
    static final double VANILLA_REACH = 3.0D;
    /** Eye height above feet. */
    static final double EYE_HEIGHT = 1.62D;
    /** Ticks over which HitObserver measures displacement. */
    static final int MEASURE_TICKS = 4;

    /** How the gap fed to the brain is computed. */
    public enum GapMode {
        /** What the mod shipped with: 3D centre-to-centre distance. */
        CENTRE_3D,
        /** Hitbox-aware horizontal surface gap. */
        SURFACE_HORIZONTAL
    }

    /** How a knockback separation sample is derived. */
    public enum SampleMode {
        /** What the mod shipped with: separation change, clamped at zero. */
        SEPARATION_CLAMPED,
        /** Victim displacement along the knockback axis. */
        AXIAL_DISPLACEMENT
    }

    public static final class Config {
        public GapMode gapMode = GapMode.CENTRE_3D;
        public SampleMode sampleMode = SampleMode.SEPARATION_CLAMPED;
        /** Server knockback multiplier: 1.0 vanilla, 0.6 "reduced kb", 1.5 "high kb". */
        public double serverKnockback = 1.0D;
        public int ticks = 4000;
        public long seed = 20261014L;
        /** Mean ping in ms, and its jitter. */
        public int pingMs = 60;
        public int pingJitterMs = 15;
    }

    public static final class Report {
        public int hitsLanded;
        public int observations;
        public double finalConfidence;
        public double peakConfidence;
        public int ticksAboveGate;
        public int ticksWithTarget;
        public int hitsUntilGate = -1;
        public int wTaps;
        public int sTaps;
        public int suppressedByConfidence;
        public double finalSeparationEstimate;
        public double trueSeparationMean;
        public double sampleCv;
        public double meanGapError;
        public double learnedReach = -1.0D;
        public int reachSamples;

        @Override
        public String toString() {
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("  hits landed            %d%n", this.hitsLanded));
            sb.append(String.format("  observations recorded  %d%n", this.observations));
            sb.append(String.format("  confidence final/peak  %.3f / %.3f%n",
                    this.finalConfidence, this.peakConfidence));
            sb.append(String.format("  hits until gate opens  %s%n",
                    this.hitsUntilGate < 0 ? "never" : Integer.toString(this.hitsUntilGate)));
            sb.append(String.format("  ticks above gate       %d / %d engaged (%.1f%%)%n",
                    this.ticksAboveGate, this.ticksWithTarget,
                    this.ticksWithTarget == 0 ? 0.0D
                            : 100.0D * this.ticksAboveGate / this.ticksWithTarget));
            sb.append(String.format("  W-taps / S-taps        %d / %d%n", this.wTaps, this.sTaps));
            sb.append(String.format("  blocked on confidence  %d ticks%n", this.suppressedByConfidence));
            sb.append(String.format("  separation est / true  %.2f / %.2f blocks%n",
                    this.finalSeparationEstimate, this.trueSeparationMean));
            sb.append(String.format("  sample noise (cv)      %.2f%n", this.sampleCv));
            sb.append(String.format("  mean gap error         %+.2f blocks%n", this.meanGapError));
            sb.append(String.format("  learned reach          %s (true %.2f) from %d hits%n",
                    this.learnedReach < 0.0D ? "none" : String.format("%.2f", this.learnedReach),
                    VANILLA_REACH, this.reachSamples));
            return sb.toString();
        }
    }

    /** One simulated player on a line, with a lateral offset for strafing. */
    private static final class Fighter {
        double x;
        double z;
        double y;
        double vx;
        double vz;
        double vy;
        boolean sprinting;
        boolean onGround = true;
        int hurtTime;
        int swingTicks = -1;

        double speed() {
            return Math.sqrt(this.vx * this.vx + this.vz * this.vz);
        }
    }

    private final Config config;
    private final Random random;

    public FightSimulation(Config config) {
        this.config = config;
        this.random = new Random(config.seed);
    }

    public Report run() {
        Report report = new Report();
        CoreSettings settings = new CoreSettings();
        CombatBrain brain = new CombatBrain(settings);
        CombatSnapshot snapshot = new CombatSnapshot();

        Fighter me = new Fighter();
        Fighter foe = new Fighter();
        me.x = 0.0D;
        foe.x = 8.0D;
        me.sprinting = true;

        double prevGap = gap(me, foe);
        double closingEwma = 0.0D;

        // Pending hit measurement, mirroring HitObserver.
        boolean measuring = false;
        int measureStart = 0;
        double startFoeX = 0.0D;
        double startFoeZ = 0.0D;
        double startGap = 0.0D;
        double peakFoeVy = 0.0D;
        boolean measureSprint = false;
        double kbAxisX = 0.0D;
        double kbAxisZ = 0.0D;

        int lastAttackTick = -100;
        int ourHitTick = -1000;
        int hitTakenTick = -1000;
        boolean lastHitSprint = false;

        double trueSeparationSum = 0.0D;
        int trueSeparationCount = 0;
        double gapErrorSum = 0.0D;
        int gapErrorCount = 0;
        final double[] samples = new double[512];
        int sampleCount = 0;

        int activeTicks = 0;
        MoveAction active = MoveAction.NONE;

        for (int tick = 1; tick <= this.config.ticks; tick++) {
            // ---------- opponent behaviour ----------
            driveOpponent(me, foe);

            // ---------- our movement, honouring the brain's plan ----------
            double forwardInput = 1.0D;
            if (active == MoveAction.W_TAP) {
                forwardInput = 0.0D;
                me.sprinting = false;
            } else if (active == MoveAction.S_TAP) {
                forwardInput = -1.0D;
                me.sprinting = false;
            } else if (!me.sprinting && forwardInput >= 0.8D) {
                // Vanilla re-arms the sprint as soon as forward comes back.
                me.sprinting = true;
            }
            double mySpeed = me.sprinting ? SPRINT_SPEED : WALK_SPEED;
            double toFoe = Math.signum(foe.x - me.x);
            if (toFoe == 0.0D) {
                toFoe = 1.0D;
            }
            // Only drive ourselves when knockback is not carrying us.
            if (Math.abs(me.vx) < 0.05D) {
                me.vx = forwardInput * mySpeed * toFoe;
            }
            // Strafing: lateral motion that genuinely perturbs the gap.
            me.vz = (this.random.nextDouble() - 0.5D) * 0.12D;

            // Occasional jump, which is what makes a 3D gap noisy.
            if (me.onGround && this.random.nextInt(14) == 0) {
                me.vy = 0.42D;
                me.onGround = false;
            }
            if (foe.onGround && this.random.nextInt(16) == 0) {
                foe.vy = 0.42D;
                foe.onGround = false;
            }

            step(me);
            step(foe);

            double currentGap = gap(me, foe);
            double trueSurface = surfaceGap(me, foe);
            gapErrorSum += currentGap - trueSurface;
            gapErrorCount++;

            double instantClosing = prevGap - currentGap;
            closingEwma += 0.5D * (instantClosing - closingEwma);
            prevGap = currentGap;

            if (me.hurtTime > 0) {
                me.hurtTime--;
            }
            if (foe.hurtTime > 0) {
                foe.hurtTime--;
            }
            if (foe.swingTicks >= 0) {
                foe.swingTicks++;
                if (foe.swingTicks > 6) {
                    foe.swingTicks = -1;
                }
            }

            // ---------- our attacks ----------
            double attackGap = surfaceGap(me, foe);
            boolean inReach = attackGap <= VANILLA_REACH;
            // Players also swing from slightly out of range.
            boolean swingsNow = (inReach || attackGap <= VANILLA_REACH + 0.4D)
                    && tick - lastAttackTick >= 4 && !measuring;
            if (swingsNow) {
                lastAttackTick = tick;
                // Out of range never connects; in range, human aim still misses.
                boolean connects = inReach && this.random.nextInt(100) < 82;
                brain.recordReachSample(attackGap, connects);
                if (connects) {
                    report.hitsLanded++;
                    ourHitTick = tick;
                    lastHitSprint = me.sprinting;
                    measureSprint = me.sprinting;

                    double axisX = foe.x - me.x;
                    double axisZ = foe.z - me.z;
                    double axisLen = Math.sqrt(axisX * axisX + axisZ * axisZ);
                    kbAxisX = axisLen > 1.0E-6D ? axisX / axisLen : 1.0D;
                    kbAxisZ = axisLen > 1.0E-6D ? axisZ / axisLen : 0.0D;

                    applyKnockback(foe, kbAxisX, kbAxisZ, me.sprinting, this.config.serverKnockback);
                    foe.hurtTime = 10;

                    measuring = true;
                    measureStart = tick;
                    startFoeX = foe.x;
                    startFoeZ = foe.z;
                    startGap = currentGap;
                    peakFoeVy = foe.vy;
                }
            }

            // ---------- opponent attacks ----------
            if (surfaceGap(me, foe) <= 2.6D && this.random.nextInt(9) == 0) {
                foe.swingTicks = 0;
                if (this.random.nextInt(100) < 70) {
                    hitTakenTick = tick;
                    me.hurtTime = 10;
                    applyKnockback(me, -kbAxisXOr(me, foe), -kbAxisZOr(me, foe),
                            foe.sprinting, this.config.serverKnockback);
                }
            }

            // ---------- derive the observation, as HitObserver does ----------
            if (measuring) {
                if (foe.vy > peakFoeVy) {
                    peakFoeVy = foe.vy;
                }
                if (tick - measureStart >= MEASURE_TICKS) {
                    double dx = foe.x - startFoeX;
                    double dz = foe.z - startFoeZ;
                    double horizontal = Math.sqrt(dx * dx + dz * dz);
                    double axial = dx * kbAxisX + dz * kbAxisZ;
                    double separationRaw = currentGap - startGap;

                    double sample;
                    if (this.config.sampleMode == SampleMode.SEPARATION_CLAMPED) {
                        sample = Math.max(0.0D, separationRaw);
                    } else {
                        sample = Math.max(0.0D, axial);
                    }
                    brain.recordKnockback(new KnockbackObservation(horizontal, peakFoeVy,
                            sample, measureSprint, 2, true));
                    report.observations++;
                    if (sampleCount < samples.length) {
                        samples[sampleCount++] = sample;
                    }
                    trueSeparationSum += Math.max(0.0D, axial);
                    trueSeparationCount++;
                    measuring = false;

                    if (report.hitsUntilGate < 0
                            && brain.knockback().confidence(measureSprint) >= settings.minConfidence()) {
                        report.hitsUntilGate = report.observations;
                    }
                }
            }

            // ---------- feed the brain ----------
            snapshot.reset();
            snapshot.tick = tick;
            snapshot.hasTarget = true;
            snapshot.targetId = 1;
            snapshot.distance = currentGap;
            snapshot.closingSpeed = closingEwma;
            snapshot.targetSpeed = foe.speed();
            snapshot.targetClosingComponent = -(foe.vx * Math.signum(foe.x - me.x));
            snapshot.targetFacingDot = 0.9D;
            snapshot.targetHurtTime = foe.hurtTime;
            snapshot.targetSwinging = foe.swingTicks >= 0;
            snapshot.targetSwingAgeTicks = foe.swingTicks;
            snapshot.selfSprinting = me.sprinting;
            snapshot.selfSpeed = me.speed();
            snapshot.selfForwardInput = forwardInput;
            snapshot.selfOnGround = me.onGround;
            snapshot.selfHurtTime = me.hurtTime;
            snapshot.attackKeyHeld = true;
            snapshot.ticksSinceOurHit = ourHitTick > -1000 ? tick - ourHitTick : -1;
            snapshot.ticksSinceHitTaken = hitTakenTick > -1000 ? tick - hitTakenTick : -1;
            snapshot.lastHitWasSprint = lastHitSprint;
            snapshot.recentHitsLanded = 1;
            snapshot.recentHitsTaken = 1;
            int ping = this.config.pingMs
                    + (int) ((this.random.nextDouble() - 0.5D) * 2.0D * this.config.pingJitterMs);
            snapshot.pingTicks = ping / 50.0D;
            snapshot.latencyUncertaintyTicks = this.config.pingJitterMs / 50.0D;
            snapshot.latencyReliable = true;

            brain.update(snapshot);

            report.ticksWithTarget++;
            double confidence = brain.knockback().overallConfidence();
            if (confidence > report.peakConfidence) {
                report.peakConfidence = confidence;
            }
            if (confidence >= settings.minConfidence()) {
                report.ticksAboveGate++;
            }
            MovementPlan plan = brain.plan();
            if (plan.reason != null && plan.reason.contains("conf")) {
                report.suppressedByConfidence++;
            }

            // ---------- run the plan ----------
            if (activeTicks > 0) {
                activeTicks--;
                if (activeTicks == 0) {
                    active = MoveAction.NONE;
                }
            } else if (plan.isActive()) {
                active = plan.action;
                activeTicks = plan.durationTicks;
                brain.onActionStarted(plan.action, plan.durationTicks, tick);
                if (plan.action == MoveAction.W_TAP) {
                    report.wTaps++;
                } else if (plan.action == MoveAction.S_TAP) {
                    report.sTaps++;
                }
            }

            // Reset the duel when they get too far apart, so one simulation
            // covers many engagements rather than one long chase.
            if (currentGap > 12.0D) {
                me.x = 0.0D;
                me.z = 0.0D;
                foe.x = 7.0D + this.random.nextDouble() * 2.0D;
                foe.z = 0.0D;
                me.vx = 0.0D;
                foe.vx = 0.0D;
                prevGap = gap(me, foe);
            }
        }

        report.learnedReach = brain.reach().estimate();
        report.reachSamples = brain.reach().hitSamples();
        report.finalConfidence = brain.knockback().overallConfidence();
        report.finalSeparationEstimate = brain.knockback().separationGain(true);
        report.trueSeparationMean = trueSeparationCount == 0 ? 0.0D
                : trueSeparationSum / trueSeparationCount;
        report.sampleCv = cv(samples, sampleCount);
        report.meanGapError = gapErrorCount == 0 ? 0.0D : gapErrorSum / gapErrorCount;
        return report;
    }

    // ------------------------------------------------------------------

    private void driveOpponent(Fighter me, Fighter foe) {
        double toMe = Math.signum(me.x - foe.x);
        if (toMe == 0.0D) {
            toMe = -1.0D;
        }
        // Mixed behaviour: mostly pushing in, sometimes backing off.
        double intent = this.random.nextInt(10) < 7 ? 1.0D : -0.6D;
        foe.sprinting = intent > 0.0D && this.random.nextBoolean();
        double speed = foe.sprinting ? SPRINT_SPEED : WALK_SPEED;
        if (Math.abs(foe.vx) < 0.05D) {
            foe.vx = intent * speed * toMe;
        }
        foe.vz = (this.random.nextDouble() - 0.5D) * 0.12D;
    }

    private static double kbAxisXOr(Fighter me, Fighter foe) {
        double dx = foe.x - me.x;
        double dz = foe.z - me.z;
        double len = Math.sqrt(dx * dx + dz * dz);
        return len > 1.0E-6D ? dx / len : 1.0D;
    }

    private static double kbAxisZOr(Fighter me, Fighter foe) {
        double dx = foe.x - me.x;
        double dz = foe.z - me.z;
        double len = Math.sqrt(dx * dx + dz * dz);
        return len > 1.0E-6D ? dz / len : 0.0D;
    }

    private static void applyKnockback(Fighter victim, double axisX, double axisZ,
                                        boolean attackerSprinting, double multiplier) {
        victim.vx /= 2.0D;
        victim.vz /= 2.0D;
        double impulse = KB_BASE * multiplier;
        victim.vx += axisX * impulse;
        victim.vz += axisZ * impulse;
        if (attackerSprinting) {
            double bonus = KB_SPRINT_BONUS * multiplier;
            victim.vx += axisX * bonus;
            victim.vz += axisZ * bonus;
        }
        victim.vy = Math.min(0.4D, victim.vy / 2.0D + 0.4D);
        victim.onGround = false;
    }

    private static void step(Fighter f) {
        f.x += f.vx;
        f.z += f.vz;
        f.y += f.vy;
        if (f.y <= 0.0D) {
            f.y = 0.0D;
            f.vy = 0.0D;
            f.onGround = true;
        } else {
            f.vy -= 0.08D;
            f.vy *= 0.98D;
            f.onGround = false;
        }
        double drag = f.onGround ? GROUND_DRAG : AIR_DRAG;
        f.vx *= drag;
        f.vz *= drag;
        if (Math.abs(f.vx) < 0.003D) {
            f.vx = 0.0D;
        }
        if (Math.abs(f.vz) < 0.003D) {
            f.vz = 0.0D;
        }
    }

    /** The gap as the mod currently computes it, per {@link GapMode}. */
    private double gap(Fighter me, Fighter foe) {
        if (this.config.gapMode == GapMode.SURFACE_HORIZONTAL) {
            return surfaceGap(me, foe);
        }
        double dx = foe.x - me.x;
        double dy = foe.y - me.y;
        double dz = foe.z - me.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Hitbox-aware horizontal gap, matching {@code TargetTracker.effectiveGap}:
     * centre distance minus the target's half-width and collision border. A hit
     * is possible at or under {@link #VANILLA_REACH} in these units, which is
     * what vanilla's eye-to-hitbox ray actually tests.
     */
    private static double surfaceGap(Fighter me, Fighter foe) {
        double dx = foe.x - me.x;
        double dz = foe.z - me.z;
        double centre = Math.sqrt(dx * dx + dz * dz);
        return Math.max(0.0D, centre - (HALF_WIDTH + COLLISION_BORDER));
    }

    private static double cv(double[] values, int count) {
        if (count < 2) {
            return 0.0D;
        }
        double sum = 0.0D;
        for (int i = 0; i < count; i++) {
            sum += values[i];
        }
        double mean = sum / count;
        if (Math.abs(mean) < 1.0E-6D) {
            return 0.0D;
        }
        double sq = 0.0D;
        for (int i = 0; i < count; i++) {
            double d = values[i] - mean;
            sq += d * d;
        }
        return Math.sqrt(sq / (count - 1)) / Math.abs(mean);
    }

    // ------------------------------------------------------------------

    public static void main(String[] args) {
        System.out.println("=== PCP calibration: what the core achieves in a simulated duel ===");
        System.out.println();

        String[] serverNames = {"vanilla kb (1.0x)", "reduced kb (0.6x)", "high kb (1.5x)"};
        double[] serverKb = {1.0D, 0.6D, 1.5D};

        for (int i = 0; i < serverKb.length; i++) {
            Config shipped = new Config();
            shipped.serverKnockback = serverKb[i];
            System.out.println(serverNames[i] + " -- as shipped (3D centre gap, clamped separation):");
            System.out.print(new FightSimulation(shipped).run());

            Config fixed = new Config();
            fixed.serverKnockback = serverKb[i];
            fixed.gapMode = GapMode.SURFACE_HORIZONTAL;
            fixed.sampleMode = SampleMode.AXIAL_DISPLACEMENT;
            System.out.println(serverNames[i] + " -- with surface gap + axial displacement:");
            System.out.print(new FightSimulation(fixed).run());
            System.out.println();
        }
    }
}
