package dev.paxiyl.pcp.sim;

import java.util.ArrayList;
import java.util.List;

/**
 * Turns {@link FightSimulation} into a pass/fail gate.
 *
 * <p>The unit suites check that each piece does what it was told. This checks
 * the thing that actually went wrong in the field: that the system as a whole
 * reaches a useful state during a real fight. Every assertion here corresponds
 * to a defect that shipped - confidence that never cleared its own gate, a
 * spacing band offset by most of a block, and an S-tap controller that never
 * once fired.</p>
 */
public final class CalibrationTest {

    /** Knockback multipliers standing in for different server configurations. */
    private static final double[] SERVERS = {1.0D, 0.6D, 1.5D};
    private static final String[] NAMES = {"vanilla", "reduced-kb", "high-kb"};

    private static int checks;
    private static final List<String> failures = new ArrayList<String>();

    public static void main(String[] args) {
        for (int i = 0; i < SERVERS.length; i++) {
            FightSimulation.Config config = new FightSimulation.Config();
            config.serverKnockback = SERVERS[i];
            config.gapMode = FightSimulation.GapMode.SURFACE_HORIZONTAL;
            config.sampleMode = FightSimulation.SampleMode.AXIAL_DISPLACEMENT;
            assertHealthy(NAMES[i], new FightSimulation(config).run());
        }

        // Latency extremes must not stop it working, only make it cautious.
        FightSimulation.Config laggy = new FightSimulation.Config();
        laggy.gapMode = FightSimulation.GapMode.SURFACE_HORIZONTAL;
        laggy.sampleMode = FightSimulation.SampleMode.AXIAL_DISPLACEMENT;
        laggy.pingMs = 220;
        laggy.pingJitterMs = 60;
        FightSimulation.Report laggyReport = new FightSimulation(laggy).run();
        assertHealthy("high-latency", laggyReport);

        System.out.println();
        System.out.println("calibration checks run: " + checks + ", failures: " + failures.size());
        for (int i = 0; i < failures.size(); i++) {
            System.out.println("  FAIL " + failures.get(i));
        }
        if (failures.isEmpty()) {
            System.out.println("ALL CALIBRATION CHECKS PASSED");
        }
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    private static void assertHealthy(String label, FightSimulation.Report r) {
        System.out.println("-- " + label);
        System.out.print(r);

        // The system has to actually observe the fight.
        check(label + ": hits were landed", r.hitsLanded > 20);
        check(label + ": observations were recorded", r.observations > 15);

        // Confidence has to become usable, and reasonably soon. This is the
        // regression guard for "the confidence is always low".
        check(label + ": confidence clears its own gate",
                r.hitsUntilGate >= 0 && r.hitsUntilGate <= 12);
        check(label + ": confidence stays usable for most of the fight",
                r.ticksWithTarget > 0
                        && (double) r.ticksAboveGate / r.ticksWithTarget > 0.5D);
        check(label + ": confidence does not claim certainty", r.peakConfidence <= 0.95D);

        // The reach it learns has to match the reach the simulation enforces.
        check(label + ": a reach estimate is produced", r.learnedReach > 0.0D);
        check(label + ": learned reach is close to the truth",
                Math.abs(r.learnedReach - FightSimulation.VANILLA_REACH) < 0.30D);

        // The gap metric must not be systematically biased.
        check(label + ": the gap metric is unbiased", Math.abs(r.meanGapError) < 0.05D);

        // Both movement controllers have to be reachable in practice.
        check(label + ": W-tap fires", r.wTaps > 5);
        check(label + ": S-tap fires at least sometimes", r.sTaps > 0);

        // The learned magnitude should be in the right neighbourhood: this is
        // an estimate blended with a prior, so the tolerance is wide on
        // purpose, but it must track the server's actual behaviour.
        check(label + ": the estimate tracks the real knockback",
                r.finalSeparationEstimate > r.trueSeparationMean * 0.5D
                        && r.finalSeparationEstimate < r.trueSeparationMean * 2.2D);
    }

    private static void check(String name, boolean condition) {
        checks++;
        if (!condition) {
            failures.add(name);
        }
    }
}
