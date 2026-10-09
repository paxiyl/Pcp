package dev.paxiyl.pcp.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Head-less self tests for the decision core.
 *
 * <p>No JUnit and no Minecraft: {@code dev.paxiyl.pcp.core} is deliberately
 * free of game classes, so this runs with a plain JDK
 * ({@code javac} then {@code java dev.paxiyl.pcp.core.CoreSelfTest}) as well as
 * through {@code gradle selfTest}. Exits non-zero when anything fails.</p>
 */
public final class CoreSelfTest {

    private static int checks;
    private static final List<String> failures = new ArrayList<String>();

    public static void main(String[] args) {
        testRollingStats();
        testKnockbackPriorsAndConfidence();
        testKnockbackRegimeChange();
        testKnockbackPersistence();
        testLatencyMeasuredVsEstimated();
        testLatencySpikeAndReliability();
        testSpacingZones();
        testSpacingPrediction();
        testStateMachineHappyPath();
        testStateMachineSafetyTransitions();
        testStateMachineStuckGuard();
        testWTapBasics();
        testWTapSkippedOnLowKnockback();
        testWTapNeedsPlayerIntent();
        testSTapGatedByConfidence();
        testSTapRefusesWhenOutpaced();
        testTapBoundsAndCooldown();
        testFlipGuard();
        testTradeImmediateCases();
        testTradeDelayCases();
        testTradeDelayNeverExceedsCap();
        testSuspendAndDisableRelease();
        testFightSimulationInvariants();
        testMovementControllerLifecycle();

        System.out.println();
        System.out.println("checks run: " + checks + ", failures: " + failures.size());
        for (int i = 0; i < failures.size(); i++) {
            System.out.println("  FAIL " + failures.get(i));
        }
        if (failures.isEmpty()) {
            System.out.println("ALL CORE SELF TESTS PASSED");
        }
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static void check(String name, boolean condition) {
        checks++;
        if (!condition) {
            failures.add(name);
        }
    }

    private static void near(String name, double expected, double actual, double tolerance) {
        checks++;
        if (Math.abs(expected - actual) > tolerance) {
            failures.add(name + " (expected " + expected + ", got " + actual + ")");
        }
    }

    private static void section(String title) {
        System.out.println("-- " + title);
    }

    private static CoreSettings defaults() {
        CoreSettings s = new CoreSettings();
        s.masterEnabled = true;
        s.wTapEnabled = true;
        s.sTapEnabled = true;
        s.tradeTimingEnabled = true;
        s.spacingEnabled = true;
        return s;
    }

    /** A snapshot of a healthy, reliable-latency engagement. */
    private static CombatSnapshot engaged(long tick, double distance) {
        CombatSnapshot s = new CombatSnapshot();
        s.tick = tick;
        s.hasTarget = true;
        s.targetId = 7;
        s.distance = distance;
        s.latencyReliable = true;
        s.latencyUncertaintyTicks = 0.4D;
        s.pingTicks = 1.0D;
        s.selfForwardInput = 1.0F;
        s.selfSprinting = true;
        s.selfSpeed = 0.28D;
        s.selfOnGround = true;
        return s;
    }

    /** Fills a profile with believable samples so confidence clears the gate. */
    private static void train(KnockbackProfile kb, int count, double separation, boolean sprint) {
        for (int i = 0; i < count; i++) {
            double jitter = (i % 3 - 1) * 0.02D;
            kb.record(new KnockbackObservation(separation * 1.1D, 0.38D, separation + jitter, sprint, 1, true));
        }
    }

    // ------------------------------------------------------------------
    // Rolling statistics
    // ------------------------------------------------------------------

    private static void testRollingStats() {
        section("rolling statistics");
        RollingStats st = new RollingStats(4, 0.5D);
        check("empty stats report zero", st.isEmpty() && st.mean() == 0.0D && st.confidence(6) == 0.0D);

        st.push(1.0D);
        st.push(2.0D);
        st.push(3.0D);
        near("mean of 1,2,3", 2.0D, st.mean(), 1.0E-9D);
        near("oldest retained sample", 1.0D, st.get(0), 1.0E-9D);
        near("newest sample", 3.0D, st.last(), 1.0E-9D);

        // Window of 4: a fifth push must evict the oldest.
        st.push(4.0D);
        st.push(5.0D);
        check("window size respected", st.count() == 4);
        near("window slid", 2.0D, st.get(0), 1.0E-9D);

        check("NaN ignored", pushAndCount(st, Double.NaN) == 4);
        check("infinity ignored", pushAndCount(st, Double.POSITIVE_INFINITY) == 4);

        RollingStats steady = new RollingStats(16, 0.3D);
        for (int i = 0; i < 16; i++) {
            steady.push(2.0D);
        }
        RollingStats noisy = new RollingStats(16, 0.3D);
        for (int i = 0; i < 16; i++) {
            noisy.push(i % 2 == 0 ? 0.5D : 3.5D);
        }
        check("steady data beats noisy data on confidence",
                steady.confidence(6) > noisy.confidence(6));
        check("confidence never reaches certainty", steady.confidence(6) <= 0.95D);
        near("zero spread means zero cv", 0.0D, steady.coefficientOfVariation(), 1.0E-9D);

        RollingStats decaying = new RollingStats(8, 0.3D);
        for (int i = 1; i <= 8; i++) {
            decaying.push(i);
        }
        decaying.decay();
        check("decay keeps the recent half", decaying.count() == 4);
        near("decay kept the newest samples", 6.5D, decaying.mean(), 1.0E-9D);
    }

    private static int pushAndCount(RollingStats st, double value) {
        st.push(value);
        return st.count();
    }

    // ------------------------------------------------------------------
    // Knockback profile
    // ------------------------------------------------------------------

    private static void testKnockbackPriorsAndConfidence() {
        section("knockback priors and confidence");
        KnockbackProfile kb = new KnockbackProfile();

        near("untrained sprint separation is the prior",
                KnockbackProfile.PRIOR_SPRINT_SEPARATION, kb.separationGain(true), 1.0E-9D);
        near("untrained walk separation is the prior",
                KnockbackProfile.PRIOR_WALK_SEPARATION, kb.separationGain(false), 1.0E-9D);
        check("untrained profile is not claimed as measured", !kb.isMeasured(true));
        near("untrained confidence is zero", 0.0D, kb.confidence(true), 1.0E-9D);
        check("untrained description says prior", kb.describe(true).startsWith("prior"));
        near("reaction ticks unknown before measurement", -1.0D, kb.reactionTicks(), 1.0E-9D);

        train(kb, 12, 2.60D, true);
        check("trained profile is measured", kb.isMeasured(true));
        check("trained confidence rises", kb.confidence(true) > 0.35D);
        check("estimate moved towards the measurement",
                kb.separationGain(true) > KnockbackProfile.PRIOR_SPRINT_SEPARATION);
        check("estimate stays at or below the measurement", kb.separationGain(true) <= 2.62D);
        check("trained description says measured", kb.describe(true).startsWith("msr"));
        check("walk bucket stays independent of the sprint bucket", !kb.isMeasured(false));
        near("walk estimate untouched",
                KnockbackProfile.PRIOR_WALK_SEPARATION, kb.separationGain(false), 1.0E-9D);
        check("reaction ticks measured after training", kb.reactionTicks() > 0.0D);

        // A low-knockback server should be learned as such.
        KnockbackProfile low = new KnockbackProfile();
        train(low, 14, 0.15D, true);
        check("low knockback server learned", low.separationGain(true) < 0.6D);

        kb.reset();
        near("reset returns to the prior",
                KnockbackProfile.PRIOR_SPRINT_SEPARATION, kb.separationGain(true), 1.0E-9D);
        check("reset clears the measured flag", !kb.isMeasured(true));
        check("reset clears sample count", kb.sampleCount(true) == 0);
    }

    private static void testKnockbackRegimeChange() {
        section("knockback regime change");
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 16, 1.80D, true);
        check("no regime change while behaviour is stable", !kb.regimeChangeSeen());
        int before = kb.sampleCount(true);

        // Behaviour changes hard: a run of samples far outside the distribution.
        for (int i = 0; i < 6; i++) {
            kb.record(new KnockbackObservation(9.0D, 0.9D, 8.5D, true, 1, true));
        }
        check("regime change detected", kb.regimeChangeSeen());
        check("window was decayed rather than kept whole", kb.sampleCount(true) < before + 6);
        check("estimate moved towards the new regime", kb.separationGain(true) > 1.9D);
    }

    private static void testKnockbackPersistence() {
        section("knockback persistence round trip");
        KnockbackProfile original = new KnockbackProfile();
        original.setServerKey("example.server");
        train(original, 10, 2.10D, true);
        train(original, 5, 0.90D, false);
        original.record(new KnockbackObservation(2.0D, 0.4D, 1.7D, true, -1, false));

        Map<String, String> saved = original.toMap();
        KnockbackProfile restored = new KnockbackProfile();
        restored.fromMap(saved);

        check("server key restored", "example.server".equals(restored.serverKey()));
        check("sprint sample count restored", restored.sampleCount(true) == original.sampleCount(true));
        check("walk sample count restored", restored.sampleCount(false) == original.sampleCount(false));
        near("sprint estimate restored", original.separationGain(true), restored.separationGain(true), 0.01D);
        near("walk estimate restored", original.separationGain(false), restored.separationGain(false), 0.01D);
        near("incoming estimate restored", original.incomingSeparation(), restored.incomingSeparation(), 0.01D);

        KnockbackProfile fromGarbage = new KnockbackProfile();
        Map<String, String> junk = new java.util.HashMap<String, String>();
        junk.put("sprintSep", "1.0,not-a-number,2.0");
        junk.put("observations", "oops");
        fromGarbage.fromMap(junk);
        check("corrupt entries are skipped, not fatal", fromGarbage.sampleCount(true) == 2);
    }

    // ------------------------------------------------------------------
    // Latency
    // ------------------------------------------------------------------

    private static void testLatencyMeasuredVsEstimated() {
        section("latency: measured versus estimated");
        LatencyModel lat = new LatencyModel();

        check("no ping before anything is reported", !lat.hasOwnPing());
        near("unknown ping reports -1", -1.0D, lat.ownPingTicks(), 1.0E-9D);
        check("unknown own latency says so", "unknown".equals(lat.describeOwnLatency()));
        near("uncertainty defaults to one tick", 1.0D, lat.uncertaintyTicks(), 1.0E-9D);

        for (int i = 0; i < 6; i++) {
            lat.recordOwnPing(60 + (i % 2 == 0 ? -4 : 4), i);
        }
        check("own ping measured", lat.hasOwnPing());
        check("own latency labelled as measured", lat.describeOwnLatency().contains("measured"));
        near("own ping in ticks", 64.0D / 50.0D, lat.ownPingTicks(), 0.1D);
        check("jitter measured", lat.ownJitterMs() > 0.0D);

        lat.recordOwnPing(0, 10);
        lat.recordOwnPing(-5, 10);
        lat.recordOwnPing(99999, 10);
        check("implausible own pings rejected", lat.ownPingMs() == 64);

        // Opponent: nothing exposed means nothing claimed.
        check("hidden opponent ping rejected", !lat.recordOpponentPing(0));
        check("opponent ping not treated as measured", !lat.opponentPingMeasured());
        near("opponent ping reports -1 when unexposed", -1.0D, lat.opponentPingMs(), 1.0E-9D);
        check("opponent description admits ignorance",
                lat.describeOpponentLatency().startsWith("unknown"));

        // Fallback estimate from position-update spacing.
        for (int i = 0; i < 8; i++) {
            lat.recordOpponentUpdateGap(3);
        }
        check("estimate available after enough gaps", lat.opponentLatencyEstimateMs() > 0.0D);
        check("estimate is labelled an estimate", lat.describeOpponentLatency().contains("est"));
        check("estimate carries confidence", lat.opponentEstimateConfidence() > 0.0D);
        check("estimate never claims to be server-reported", !lat.opponentPingMeasured());

        // Exposed ping takes over and is labelled differently.
        check("plausible opponent ping accepted", lat.recordOpponentPing(85));
        check("exposed opponent ping is measured", lat.opponentPingMeasured());
        check("exposed opponent ping labelled server-reported",
                lat.describeOpponentLatency().contains("server-reported"));

        lat.clearOpponent();
        check("clearing the opponent drops their data", !lat.opponentPingMeasured());
    }

    private static void testLatencySpikeAndReliability() {
        section("latency: spikes and reliability");
        LatencyModel lat = new LatencyModel();
        check("no data means unreliable", lat.unreliable(0L));

        for (int i = 0; i < 8; i++) {
            lat.recordOwnPing(45, i);
        }
        check("steady latency is reliable", !lat.unreliable(8L));
        near("steady latency needs little slack", 0.0D, lat.uncertaintyTicks(), 0.05D);

        lat.recordOwnPing(400, 9L);
        check("spike detected", lat.spiking(9L));
        check("spike makes the model unreliable", lat.unreliable(10L));
        check("spike eventually expires", !lat.spiking(200L));

        LatencyModel stale = new LatencyModel();
        for (int i = 0; i < 5; i++) {
            stale.recordOwnPing(50, i);
        }
        check("stale player-list data is unreliable", stale.unreliable(500L));

        LatencyModel jittery = new LatencyModel();
        for (int i = 0; i < 10; i++) {
            jittery.recordOwnPing(i % 2 == 0 ? 40 : 300, i);
        }
        check("wildly variable latency is unreliable", jittery.unreliable(10L));
        check("variable latency demands more slack", jittery.uncertaintyTicks() > 1.0D);
        check("slack is capped", jittery.uncertaintyTicks() <= 4.0D);

        LatencyModel resp = new LatencyModel();
        near("no response measurement yet", -1.0D, resp.hitResponseTicks(), 1.0E-9D);
        resp.recordHitResponse(2);
        resp.recordHitResponse(3);
        check("hit response measured", resp.hitResponseTicks() > 0.0D);
        resp.recordHitResponse(900);
        check("absurd response samples rejected", resp.hitResponseSamples() == 2);
    }

    // ------------------------------------------------------------------
    // Spacing
    // ------------------------------------------------------------------

    private static void testSpacingZones() {
        section("spacing zones");
        CoreSettings cfg = defaults();
        cfg.setEffectiveRange(3.0D);
        KnockbackProfile kb = new KnockbackProfile();
        SpacingModel sp = new SpacingModel();

        CombatSnapshot none = new CombatSnapshot();
        check("no target is out of range", sp.classify(none, cfg, kb) == SpacingZone.OUT_OF_RANGE);

        check("far away", sp.classify(engaged(1, 6.0D), cfg, kb) == SpacingZone.OUT_OF_RANGE);
        check("entering range", sp.classify(engaged(1, 3.4D), cfg, kb) == SpacingZone.ENTERING);
        check("combo band", sp.classify(engaged(1, 2.5D), cfg, kb) == SpacingZone.COMBO_BAND);
        check("dangerously close", sp.classify(engaged(1, 1.2D), cfg, kb) == SpacingZone.DANGER_CLOSE);

        CombatSnapshot gap = engaged(1, 3.6D);
        gap.ticksSinceOurHit = 2;
        gap.lastHitWasSprint = true;
        check("knockback gap recognised", sp.classify(gap, cfg, kb) == SpacingZone.KNOCKBACK_GAP);
        check("knockback gap explains itself", sp.rationale().contains("after hit"));

        CombatSnapshot walkIn = engaged(1, 2.8D);
        walkIn.targetSwinging = true;
        walkIn.targetSwingAgeTicks = 1;
        walkIn.targetFacingDot = 0.9D;
        walkIn.closingSpeed = 0.12D;
        check("walking into a live swing is flagged",
                sp.classify(walkIn, cfg, kb) == SpacingZone.WALK_IN_RISK);

        CombatSnapshot oldSwing = engaged(1, 2.8D);
        oldSwing.targetSwinging = true;
        oldSwing.targetSwingAgeTicks = 9;
        oldSwing.targetFacingDot = 0.9D;
        oldSwing.closingSpeed = 0.12D;
        check("a stale swing is not a live threat",
                sp.classify(oldSwing, cfg, kb) != SpacingZone.WALK_IN_RISK);

        CombatSnapshot turnedAway = engaged(1, 2.8D);
        turnedAway.targetSwinging = true;
        turnedAway.targetSwingAgeTicks = 1;
        turnedAway.targetFacingDot = -0.8D;
        turnedAway.closingSpeed = 0.12D;
        check("a swing aimed elsewhere is not a threat to us",
                sp.classify(turnedAway, cfg, kb) != SpacingZone.WALK_IN_RISK);

        // Projection pulls a nominally safe gap into the danger band.
        CombatSnapshot rushing = engaged(1, 2.0D);
        rushing.closingSpeed = 0.30D;
        check("projection sees the collision coming",
                sp.classify(rushing, cfg, kb) == SpacingZone.DANGER_CLOSE);

        // Range is configurable, not assumed.
        cfg.setEffectiveRange(4.0D);
        check("larger configured range moves the bands",
                sp.classify(engaged(1, 3.4D), cfg, kb) == SpacingZone.COMBO_BAND);
        cfg.setEffectiveRange(3.0D);
    }

    private static void testSpacingPrediction() {
        section("spacing prediction");
        CoreSettings cfg = defaults();
        SpacingModel sp = new SpacingModel();

        CombatSnapshot s = engaged(1, 4.0D);
        s.closingSpeed = 0.25D;
        near("linear projection", 3.0D, sp.predictedDistance(s, 4), 1.0E-9D);
        check("projection never goes negative", sp.predictedDistance(s, 100) == 0.0D);
        check("ticks to range computed", sp.ticksToRange(s, cfg) == 4);

        CombatSnapshot stable = engaged(1, 4.0D);
        stable.closingSpeed = 0.0D;
        check("not closing means no eta", sp.ticksToRange(stable, cfg) == -1);

        CombatSnapshot inRange = engaged(1, 2.0D);
        inRange.closingSpeed = 0.2D;
        check("already in range is eta zero", sp.ticksToRange(inRange, cfg) == 0);

        CombatSnapshot tooClose = engaged(1, 1.0D);
        tooClose.targetClosingComponent = 0.0D;
        int needed = SpacingModel.ticksToRecoverBand(tooClose, cfg, 0.2D);
        check("recovery ticks are positive and bounded", needed > 0 && needed < 20);

        CombatSnapshot chased = engaged(1, 1.0D);
        chased.targetClosingComponent = 0.5D;
        check("retreat that cannot outpace them reports -1",
                SpacingModel.ticksToRecoverBand(chased, cfg, 0.2D) == -1);

        CombatSnapshot alreadyFine = engaged(1, 2.8D);
        check("no recovery needed inside the band",
                SpacingModel.ticksToRecoverBand(alreadyFine, cfg, 0.2D) == 0);
    }

    // ------------------------------------------------------------------
    // State machine
    // ------------------------------------------------------------------

    private static void testStateMachineHappyPath() {
        section("state machine: approach to combo");
        CoreSettings cfg = defaults();
        FightStateMachine fsm = new FightStateMachine();

        CombatSnapshot idle = new CombatSnapshot();
        idle.tick = 1;
        check("no target means idle", fsm.update(idle, cfg, SpacingZone.OUT_OF_RANGE) == FightState.IDLE);

        FightState state = FightState.IDLE;
        for (long t = 2; t <= 6; t++) {
            CombatSnapshot s = engaged(t, 5.0D);
            s.closingSpeed = 0.2D;
            state = fsm.update(s, cfg, SpacingZone.OUT_OF_RANGE);
        }
        check("closing on a distant target is approach", state == FightState.APPROACH);
        check("approach gives a reason", fsm.reason().length() > 0);

        for (long t = 7; t <= 12; t++) {
            state = fsm.update(engaged(t, 2.6D), cfg, SpacingZone.COMBO_BAND);
        }
        check("inside range is engagement", state == FightState.ENGAGEMENT);

        for (long t = 13; t <= 18; t++) {
            CombatSnapshot s = engaged(t, 2.4D);
            s.ticksSinceOurHit = 1;
            s.lastHitWasSprint = true;
            state = fsm.update(s, cfg, SpacingZone.COMBO_BAND);
        }
        check("a confirmed hit becomes combo", state == FightState.COMBO);

        for (long t = 19; t <= 24; t++) {
            CombatSnapshot s = engaged(t, 2.2D);
            s.ticksSinceOurHit = 3;
            s.ticksSinceHitTaken = 3;
            state = fsm.update(s, cfg, SpacingZone.COMBO_BAND);
        }
        check("both sides connecting is a trade", state == FightState.TRADE);

        for (long t = 25; t <= 40; t++) {
            state = fsm.update(engaged(t, 2.4D), cfg, SpacingZone.COMBO_BAND);
        }
        check("a cooled-off trade returns to engagement", state == FightState.ENGAGEMENT);
        check("transitions were counted", fsm.transitions() >= 4);
    }

    private static void testStateMachineSafetyTransitions() {
        section("state machine: safety transitions");
        CoreSettings cfg = defaults();
        FightStateMachine fsm = new FightStateMachine();

        FightState state = FightState.IDLE;
        for (long t = 1; t <= 8; t++) {
            state = fsm.update(engaged(t, 2.4D), cfg, SpacingZone.COMBO_BAND);
        }
        check("engaged before the hit", state == FightState.ENGAGEMENT);

        CombatSnapshot hit = engaged(9, 2.0D);
        hit.ticksSinceHitTaken = 0;
        hit.selfHurtTime = 9;
        state = fsm.update(hit, cfg, SpacingZone.DANGER_CLOSE);
        check("taking a hit goes straight to recovery, no dwell wait", state == FightState.RECOVERY);

        for (long t = 10; t <= 30; t++) {
            CombatSnapshot s = engaged(t, 3.8D);
            s.ticksSinceHitTaken = (int) (t - 9);
            state = fsm.update(s, cfg, SpacingZone.KNOCKBACK_GAP);
        }
        check("recovery leads back to approach once settled", state == FightState.APPROACH);

        // Losing the exchange should break off rather than keep trading.
        FightStateMachine losing = new FightStateMachine();
        CombatSnapshot bad = engaged(5, 2.2D);
        bad.recentHitsTaken = 3;
        bad.recentHitsLanded = 0;
        FightState disengage = losing.update(bad, cfg, SpacingZone.DANGER_CLOSE);
        check("a lost exchange disengages", disengage == FightState.DISENGAGE);
        check("disengage explains the score", losing.reason().contains("0-3"));

        // Target disappearing always wins.
        CombatSnapshot gone = new CombatSnapshot();
        gone.tick = 6;
        check("losing the target returns to idle",
                losing.update(gone, cfg, SpacingZone.OUT_OF_RANGE) == FightState.IDLE);

        // Out of max tracking range is the same as no target.
        CombatSnapshot far = engaged(7, 12.0D);
        check("a target past the tracking limit is dropped",
                losing.update(far, cfg, SpacingZone.OUT_OF_RANGE) == FightState.IDLE);
    }

    private static void testStateMachineStuckGuard() {
        section("state machine: stuck guard");
        CoreSettings cfg = defaults();
        cfg.setStateStuckTicks(20);
        FightStateMachine fsm = new FightStateMachine();

        FightState state = FightState.IDLE;
        for (long t = 1; t <= 8; t++) {
            state = fsm.update(engaged(t, 5.0D), cfg, SpacingZone.OUT_OF_RANGE);
        }
        check("approach reached", state == FightState.APPROACH);

        // Nothing changes for a long time: the guard must fire.
        boolean sawIdle = false;
        for (long t = 9; t <= 120; t++) {
            state = fsm.update(engaged(t, 5.0D), cfg, SpacingZone.OUT_OF_RANGE);
            if (state == FightState.IDLE) {
                sawIdle = true;
                break;
            }
        }
        check("stuck guard drops back to idle", sawIdle);
        check("stuck guard says why", fsm.reason().contains("stuck"));
    }

    // ------------------------------------------------------------------
    // Movement planning
    // ------------------------------------------------------------------

    private static void testWTapBasics() {
        section("W-tap planning");
        CoreSettings cfg = defaults();
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 12, 1.90D, true);
        TapPlanner planner = new TapPlanner();

        CombatSnapshot s = engaged(50, 2.4D);
        s.ticksSinceOurHit = 0;
        s.lastHitWasSprint = true;
        MovementPlan plan = planner.plan(s, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);

        check("W-tap issued after a confirmed sprint hit", plan.action == MoveAction.W_TAP);
        check("duration within configured bounds",
                plan.durationTicks >= cfg.minTapTicks() && plan.durationTicks <= cfg.maxTapTicks());
        check("decision explains itself", plan.reason.contains("sprint reset"));
        check("reason reports the measured separation", plan.reason.contains("sep"));
        planner.onActionStarted(plan.action, plan.durationTicks, s.tick);

        // The same hit must not be tapped twice.
        CombatSnapshot again = engaged(51, 2.5D);
        again.ticksSinceOurHit = 1;
        again.lastHitWasSprint = true;
        MovementPlan repeat = planner.plan(again, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("one tap per hit", repeat.action != MoveAction.W_TAP);

        // Idle, suspended, and master-off must all produce nothing.
        TapPlanner fresh = new TapPlanner();
        CombatSnapshot ready = engaged(60, 2.4D);
        ready.ticksSinceOurHit = 0;
        ready.lastHitWasSprint = true;
        check("no action while idle",
                fresh.plan(ready, cfg, kb, FightState.IDLE, SpacingZone.COMBO_BAND, false).action == MoveAction.NONE);
        check("no action while suspended",
                fresh.plan(ready, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, true).action == MoveAction.NONE);
        cfg.masterEnabled = false;
        check("no action while disabled",
                fresh.plan(ready, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false).action == MoveAction.NONE);
        cfg.masterEnabled = true;
        cfg.wTapEnabled = false;
        check("no W-tap when the module is off",
                fresh.plan(ready, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false).action != MoveAction.W_TAP);
        cfg.wTapEnabled = true;

        // Unreliable latency must stop movement corrections.
        CombatSnapshot laggy = engaged(70, 2.4D);
        laggy.ticksSinceOurHit = 0;
        laggy.lastHitWasSprint = true;
        laggy.latencyReliable = false;
        MovementPlan none = new TapPlanner().plan(laggy, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("unreliable latency stops corrections", none.action == MoveAction.NONE);
        check("unreliable latency is reported", none.reason.contains("latency"));

        // A jittery but usable link should widen the window, not shorten it.
        TapPlanner wide = new TapPlanner();
        CombatSnapshot jitter = engaged(80, 2.4D);
        jitter.ticksSinceOurHit = 1;
        jitter.lastHitWasSprint = true;
        jitter.latencyUncertaintyTicks = 2.5D;
        MovementPlan widePlan = wide.plan(jitter, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("a hit is still caught on a jittery link", widePlan.action == MoveAction.W_TAP);
        check("latency slack lengthens the release", widePlan.durationTicks > cfg.minTapTicks());
        check("still inside the hard cap", widePlan.durationTicks <= cfg.maxTapTicks());
    }

    private static void testWTapSkippedOnLowKnockback() {
        section("W-tap skipped where knockback is small");
        CoreSettings cfg = defaults();
        KnockbackProfile low = new KnockbackProfile();
        train(low, 16, 0.20D, true);
        check("profile is confident about the low value", low.confidence(true) >= cfg.minConfidence());

        CombatSnapshot s = engaged(40, 2.4D);
        s.ticksSinceOurHit = 0;
        s.lastHitWasSprint = true;
        MovementPlan plan = new TapPlanner().plan(s, cfg, low, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("no tap when a sprint reset buys nothing", plan.action == MoveAction.NONE);
        check("the reason names the measurement", plan.reason.contains("sep"));
    }

    private static void testWTapNeedsPlayerIntent() {
        section("W-tap only releases what the player holds");
        CoreSettings cfg = defaults();
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 12, 1.90D, true);

        CombatSnapshot notMoving = engaged(30, 2.4D);
        notMoving.ticksSinceOurHit = 0;
        notMoving.lastHitWasSprint = true;
        notMoving.selfForwardInput = 0.0F;
        check("nothing to release when the player is not pressing forward",
                new TapPlanner().plan(notMoving, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false)
                        .action == MoveAction.NONE);

        CombatSnapshot notSprinting = engaged(31, 2.4D);
        notSprinting.ticksSinceOurHit = 0;
        notSprinting.lastHitWasSprint = true;
        notSprinting.selfSprinting = false;
        check("no sprint to reset means no tap",
                new TapPlanner().plan(notSprinting, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false)
                        .action == MoveAction.NONE);

        CombatSnapshot sneaking = engaged(32, 2.4D);
        sneaking.ticksSinceOurHit = 0;
        sneaking.lastHitWasSprint = true;
        sneaking.selfForwardInput = 0.3F;
        check("sneak-scaled input is not a sprint intent",
                new TapPlanner().plan(sneaking, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false)
                        .action == MoveAction.NONE);
    }

    private static void testSTapGatedByConfidence() {
        section("S-tap confidence gate");
        CoreSettings cfg = defaults();
        cfg.setMinConfidence(0.35D);

        CombatSnapshot s = engaged(40, 1.2D);
        s.targetClosingComponent = 0.05D;
        s.selfSpeed = 0.20D;

        KnockbackProfile unsure = new KnockbackProfile();
        MovementPlan blocked = new TapPlanner().plan(s, cfg, unsure, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, false);
        check("no S-tap without confidence", blocked.action == MoveAction.NONE);
        check("the gate explains itself", blocked.reason.contains("conf"));

        KnockbackProfile sure = new KnockbackProfile();
        train(sure, 16, 1.90D, true);
        MovementPlan allowed = new TapPlanner().plan(s, cfg, sure, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, false);
        check("S-tap allowed once confident", allowed.action == MoveAction.S_TAP);
        check("S-tap duration bounded",
                allowed.durationTicks >= cfg.minTapTicks() && allowed.durationTicks <= cfg.maxTapTicks());
        check("S-tap explains the spacing problem", allowed.reason.contains("too close")
                || allowed.reason.contains("incoming swing"));

        cfg.sTapEnabled = false;
        check("S-tap module switch respected",
                new TapPlanner().plan(s, cfg, sure, FightState.TRADE, SpacingZone.DANGER_CLOSE, false)
                        .action != MoveAction.S_TAP);
        cfg.sTapEnabled = true;

        cfg.spacingEnabled = false;
        check("spacing switch also gates S-tap",
                new TapPlanner().plan(s, cfg, sure, FightState.TRADE, SpacingZone.DANGER_CLOSE, false)
                        .action != MoveAction.S_TAP);
        cfg.spacingEnabled = true;

        CombatSnapshot alreadyBacking = engaged(41, 1.2D);
        alreadyBacking.selfForwardInput = -1.0F;
        alreadyBacking.targetClosingComponent = 0.05D;
        check("no S-tap while the player is already backing off",
                new TapPlanner().plan(alreadyBacking, cfg, sure, FightState.TRADE,
                        SpacingZone.DANGER_CLOSE, false).action != MoveAction.S_TAP);

        CombatSnapshot comfortable = engaged(42, 2.5D);
        check("no S-tap from a healthy distance",
                new TapPlanner().plan(comfortable, cfg, sure, FightState.ENGAGEMENT,
                        SpacingZone.COMBO_BAND, false).action != MoveAction.S_TAP);
    }

    private static void testSTapRefusesWhenOutpaced() {
        section("S-tap refuses hopeless retreats");
        CoreSettings cfg = defaults();
        KnockbackProfile sure = new KnockbackProfile();
        train(sure, 16, 1.90D, true);

        CombatSnapshot chased = engaged(50, 1.2D);
        chased.targetClosingComponent = 0.6D;
        chased.selfSpeed = 0.20D;
        MovementPlan plan = new TapPlanner().plan(chased, cfg, sure, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, false);
        check("no pointless retreat", plan.action == MoveAction.NONE);
        check("the refusal is explained", plan.reason.contains("outpace"));
    }

    private static void testTapBoundsAndCooldown() {
        section("tap bounds and cooldown");
        CoreSettings cfg = defaults();
        cfg.setMinTapTicks(2);
        cfg.setMaxTapTicks(2);
        cfg.setActionCooldownTicks(10);
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 16, 2.80D, true);

        TapPlanner planner = new TapPlanner();
        CombatSnapshot s = engaged(100, 2.4D);
        s.ticksSinceOurHit = 0;
        s.lastHitWasSprint = true;
        s.latencyUncertaintyTicks = 3.9D;
        MovementPlan plan = planner.plan(s, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("a pinned window forces an exact duration",
                plan.action == MoveAction.W_TAP && plan.durationTicks == 2);
        planner.onActionStarted(plan.action, plan.durationTicks, s.tick);

        CombatSnapshot during = engaged(104, 2.4D);
        during.ticksSinceOurHit = 0;
        during.lastHitWasSprint = true;
        MovementPlan blocked = planner.plan(during, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("cooldown blocks the next action", blocked.action == MoveAction.NONE);
        check("cooldown reports remaining ticks", blocked.reason.contains("cooldown"));
        check("cooldown remaining is positive", planner.cooldownRemaining(104L, cfg) > 0);

        CombatSnapshot after = engaged(130, 2.4D);
        after.ticksSinceOurHit = 0;
        after.lastHitWasSprint = true;
        check("cooldown expires",
                planner.plan(after, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false)
                        .action == MoveAction.W_TAP);

        // Mis-ordered bounds must self-correct rather than invert.
        CoreSettings weird = defaults();
        weird.setMaxTapTicks(2);
        weird.setMinTapTicks(7);
        check("minimum cannot exceed maximum", weird.minTapTicks() <= weird.maxTapTicks());
        weird.setMinTapTicks(1);
        weird.setMaxTapTicks(99);
        check("maximum is clamped to the hard cap", weird.maxTapTicks() <= 10);
        weird.setEffectiveRange(99.0D);
        check("range is clamped", weird.effectiveRange() <= 4.5D);
        weird.setMaxTradeDelayTicks(99);
        check("attack hold is clamped", weird.maxTradeDelayTicks() <= 6);
        weird.setDangerCloseFraction(0.9D);
        check("bands cannot cross", weird.dangerCloseFraction() < weird.comboBandFraction());
    }

    private static void testFlipGuard() {
        section("direction flip guard");
        CoreSettings cfg = defaults();
        cfg.setActionCooldownTicks(0);
        cfg.setDirectionFlipGuardTicks(10);
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 16, 1.90D, true);

        TapPlanner planner = new TapPlanner();
        planner.onActionStarted(MoveAction.S_TAP, 2, 100L);

        CombatSnapshot s = engaged(103, 2.4D);
        s.ticksSinceOurHit = 0;
        s.lastHitWasSprint = true;
        MovementPlan plan = planner.plan(s, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false);
        check("no immediate reversal after an S-tap", plan.action == MoveAction.NONE);
        check("the guard is named", plan.reason.contains("flip guard"));

        CombatSnapshot later = engaged(125, 2.4D);
        later.ticksSinceOurHit = 0;
        later.lastHitWasSprint = true;
        check("reversal allowed once the guard expires",
                planner.plan(later, cfg, kb, FightState.COMBO, SpacingZone.COMBO_BAND, false)
                        .action == MoveAction.W_TAP);
    }

    // ------------------------------------------------------------------
    // Trade timing
    // ------------------------------------------------------------------

    private static void testTradeImmediateCases() {
        section("trade timing: send it now");
        CoreSettings cfg = defaults();
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 16, 1.90D, true);
        train(kb, 16, 0.80D, false);
        TradeDecider trade = new TradeDecider();

        CombatSnapshot s = engaged(200, 2.4D);
        TradeAdvice override = trade.decide(s, cfg, kb, FightState.TRADE, SpacingZone.DANGER_CLOSE,
                null, false, true);
        check("manual override always passes through", override.decision == TradeDecision.ATTACK_NOW);
        check("override is labelled", override.reason.contains("manual"));
        check("override adds no delay", override.delayTicks == 0);

        cfg.tradeTimingEnabled = false;
        check("module off passes through", trade.decide(s, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, null, false, false).decision == TradeDecision.ATTACK_NOW);
        cfg.tradeTimingEnabled = true;

        check("suspended passes through", trade.decide(s, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, null, true, false).decision == TradeDecision.ATTACK_NOW);

        CombatSnapshot laggy = engaged(201, 2.4D);
        laggy.latencyReliable = false;
        TradeAdvice lag = trade.decide(laggy, cfg, kb, FightState.TRADE, SpacingZone.DANGER_CLOSE,
                null, false, false);
        check("unreliable latency stops gating", lag.decision == TradeDecision.ATTACK_NOW);
        check("latency reason given", lag.reason.contains("latency"));

        KnockbackProfile unsure = new KnockbackProfile();
        TradeAdvice lowConf = trade.decide(s, cfg, unsure, FightState.TRADE, SpacingZone.DANGER_CLOSE,
                null, false, false);
        check("low confidence stops gating", lowConf.decision == TradeDecision.ATTACK_NOW);
        check("confidence reason given", lowConf.reason.contains("conf"));

        CombatSnapshot hurt = engaged(202, 2.0D);
        hurt.selfHurtTime = 8;
        hurt.ticksSinceHitTaken = 0;
        TradeAdvice contested = trade.decide(hurt, cfg, kb, FightState.TRADE, SpacingZone.DANGER_CLOSE,
                null, false, false);
        check("never hold while being hit", contested.decision == TradeDecision.ATTACK_NOW);
        check("contested reason given", contested.reason.contains("contested"));

        CombatSnapshot sprinting = engaged(203, 2.4D);
        TradeAdvice sprintHit = trade.decide(sprinting, cfg, kb, FightState.ENGAGEMENT,
                SpacingZone.COMBO_BAND, null, false, false);
        check("a ready sprint hit is taken", sprintHit.decision == TradeDecision.ATTACK_NOW);
        check("sprint reason given", sprintHit.reason.contains("sprint"));

        CombatSnapshot stranded = engaged(204, 5.0D);
        stranded.closingSpeed = 0.0D;
        TradeAdvice far = trade.decide(stranded, cfg, kb, FightState.APPROACH,
                SpacingZone.OUT_OF_RANGE, null, false, false);
        check("no point holding when not closing", far.decision == TradeDecision.ATTACK_NOW);

        cfg.setMaxTradeDelayTicks(0);
        check("a zero cap disables holding entirely", trade.decide(s, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, null, false, false).decision == TradeDecision.ATTACK_NOW);
        cfg.setMaxTradeDelayTicks(3);
    }

    private static void testTradeDelayCases() {
        section("trade timing: holding briefly");
        CoreSettings cfg = defaults();
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 16, 1.90D, true);
        train(kb, 16, 0.80D, false);
        TradeDecider trade = new TradeDecider();

        // Closing on a target just out of range: wait for the hit to connect.
        CombatSnapshot closing = engaged(300, 3.5D);
        closing.closingSpeed = 0.25D;
        closing.selfSprinting = false;
        TradeAdvice wait = trade.decide(closing, cfg, kb, FightState.APPROACH,
                SpacingZone.ENTERING, null, false, false);
        check("hold until the target is in range", wait.decision == TradeDecision.DELAY);
        check("hold is short", wait.delayTicks > 0 && wait.delayTicks <= cfg.maxTradeDelayTicks());
        check("hold explains the range gain", wait.reason.contains("range in"));

        // Their swing is in flight and we have no sprint hit ready.
        CombatSnapshot incoming = engaged(301, 1.4D);
        incoming.selfSprinting = false;
        incoming.selfForwardInput = 0.0F;
        incoming.targetSwinging = true;
        incoming.targetSwingAgeTicks = 1;
        incoming.targetFacingDot = 0.9D;
        TradeAdvice dodge = trade.decide(incoming, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, null, false, false);
        check("avoid a simultaneous trade", dodge.decision == TradeDecision.DELAY);
        check("swing timing is explained", dodge.reason.contains("swing"));
        check("hold respects the cap", dodge.delayTicks <= cfg.maxTradeDelayTicks());

        // A knockback gap about to close.
        CombatSnapshot gap = engaged(302, 3.4D);
        gap.closingSpeed = 0.3D;
        gap.selfSprinting = false;
        gap.ticksSinceOurHit = 2;
        gap.lastHitWasSprint = true;
        TradeAdvice gapAdvice = trade.decide(gap, cfg, kb, FightState.COMBO,
                SpacingZone.KNOCKBACK_GAP, null, false, false);
        check("wait out a closing knockback gap", gapAdvice.decision == TradeDecision.DELAY);

        // A movement correction in flight: let it finish first.
        MovementPlan active = new MovementPlan();
        active.set(MoveAction.S_TAP, 2, "too close", 0.6D);
        CombatSnapshot repositioning = engaged(303, 1.3D);
        repositioning.selfSprinting = false;
        repositioning.selfForwardInput = 0.0F;
        TradeAdvice reposition = trade.decide(repositioning, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, active, false, false);
        check("let the correction land first", reposition.decision == TradeDecision.REPOSITION);
        check("reposition names the action", reposition.reason.contains("S-tap"));

        // Waiting that would cost range must be refused.
        CombatSnapshot opening = engaged(304, 2.9D);
        opening.selfSprinting = false;
        opening.selfForwardInput = 0.0F;
        opening.closingSpeed = -0.4D;
        opening.targetSwinging = true;
        opening.targetSwingAgeTicks = 1;
        opening.targetFacingDot = 0.9D;
        TradeAdvice refuse = trade.decide(opening, cfg, kb, FightState.TRADE,
                SpacingZone.DANGER_CLOSE, null, false, false);
        check("do not wait if the range is running away", refuse.decision == TradeDecision.ATTACK_NOW);
        check("losing range is explained", refuse.reason.contains("lose range"));
    }

    private static void testTradeDelayNeverExceedsCap() {
        section("trade timing: the cap always holds");
        CoreSettings cfg = defaults();
        KnockbackProfile kb = new KnockbackProfile();
        train(kb, 20, 1.90D, true);
        train(kb, 20, 0.80D, false);
        TradeDecider trade = new TradeDecider();
        Random random = new Random(987654321L);

        for (int cap = 0; cap <= 6; cap++) {
            cfg.setMaxTradeDelayTicks(cap);
            for (int i = 0; i < 4000; i++) {
                CombatSnapshot s = randomSnapshot(random, i);
                MovementPlan plan = null;
                if (random.nextBoolean()) {
                    plan = new MovementPlan();
                    plan.set(random.nextBoolean() ? MoveAction.S_TAP : MoveAction.W_TAP,
                            1 + random.nextInt(9), "fuzz", random.nextDouble());
                }
                TradeAdvice advice = trade.decide(s, cfg, kb,
                        FightState.values()[random.nextInt(FightState.values().length)],
                        SpacingZone.values()[random.nextInt(SpacingZone.values().length)],
                        plan, random.nextInt(8) == 0, random.nextInt(8) == 0);
                if (advice.delayTicks > cap || advice.delayTicks < 0) {
                    failures.add("trade delay " + advice.delayTicks + " outside cap " + cap);
                    checks++;
                    return;
                }
                if (advice.decision == TradeDecision.ATTACK_NOW && advice.delayTicks != 0) {
                    failures.add("attack-now carried a delay");
                    checks++;
                    return;
                }
            }
        }
        checks++;
        cfg.setMaxTradeDelayTicks(3);
    }

    // ------------------------------------------------------------------
    // Suspension and disable
    // ------------------------------------------------------------------

    private static void testSuspendAndDisableRelease() {
        section("suspend and disable");
        CoreSettings cfg = defaults();
        CombatBrain brain = new CombatBrain(cfg);
        train(brain.knockback(), 16, 1.90D, true);

        CombatSnapshot s = engaged(400, 2.4D);
        s.ticksSinceOurHit = 0;
        s.lastHitWasSprint = true;
        brain.update(s);
        check("brain plans a tap when everything is ready",
                brain.plan().action == MoveAction.W_TAP);

        brain.setSuspended(true, "test");
        CombatSnapshot s2 = engaged(402, 2.4D);
        s2.ticksSinceOurHit = 0;
        s2.lastHitWasSprint = true;
        brain.update(s2);
        check("suspension clears the plan", brain.plan().action == MoveAction.NONE);
        check("suspension is reported", brain.suspended());

        brain.setSuspended(false, "test over");
        cfg.masterEnabled = false;
        CombatSnapshot s3 = engaged(404, 2.4D);
        s3.ticksSinceOurHit = 0;
        s3.lastHitWasSprint = true;
        brain.update(s3);
        check("disabling clears the plan", brain.plan().action == MoveAction.NONE);
        cfg.masterEnabled = true;

        brain.resetFight("test reset");
        check("reset returns to idle", brain.state() == FightState.IDLE);
        check("reset keeps what was learned", brain.knockback().isMeasured(true));
        check("decision log recorded something", brain.log().size() > 0);
        check("decision log has a newest entry", brain.log().newest() != null);
    }

    // ------------------------------------------------------------------
    // Whole-fight invariants
    // ------------------------------------------------------------------

    /**
     * Drives the brain through thousands of randomised fight ticks and asserts
     * the invariants that matter for safety: bounded durations, the cooldown,
     * no oscillation between opposite directions, and no action while the mod
     * is off, suspended or flying blind.
     */
    private static void testFightSimulationInvariants() {
        section("whole-fight invariants (randomised)");
        CoreSettings cfg = defaults();
        cfg.setActionCooldownTicks(6);
        cfg.setDirectionFlipGuardTicks(8);
        CombatBrain brain = new CombatBrain(cfg);
        Random random = new Random(13579L);

        long lastStartTick = Long.MIN_VALUE;
        MoveAction lastStarted = MoveAction.NONE;
        long lastEndTick = Long.MIN_VALUE;
        int actions = 0;
        int activeRemaining = 0;
        boolean ok = true;

        for (long tick = 1; tick <= 20000 && ok; tick++) {
            CombatSnapshot s = randomSnapshot(random, tick);
            s.tick = tick;
            boolean suspended = random.nextInt(500) == 0;
            if (suspended) {
                brain.setSuspended(true, "fuzz");
            } else if (brain.suspended() && random.nextInt(10) == 0) {
                brain.setSuspended(false, "fuzz");
            }
            if (random.nextInt(900) == 0) {
                cfg.masterEnabled = !cfg.masterEnabled;
            }
            if (random.nextInt(700) == 0) {
                brain.recordKnockback(new KnockbackObservation(1.9D, 0.38D,
                        1.6D + random.nextDouble() * 0.3D, true, 1, true));
            }

            brain.update(s);
            MovementPlan plan = brain.plan();

            if (activeRemaining > 0) {
                activeRemaining--;
                continue;
            }

            if (!plan.isActive()) {
                continue;
            }

            // Invariants on every action the controller would start.
            if (plan.durationTicks < cfg.minTapTicks() || plan.durationTicks > cfg.maxTapTicks()) {
                failures.add("duration " + plan.durationTicks + " outside ["
                        + cfg.minTapTicks() + "," + cfg.maxTapTicks() + "]");
                ok = false;
                break;
            }
            if (!cfg.masterEnabled || brain.suspended()) {
                failures.add("acted while off or suspended");
                ok = false;
                break;
            }
            if (!s.latencyReliable) {
                failures.add("acted on unreliable latency");
                ok = false;
                break;
            }
            if (brain.state() == FightState.IDLE) {
                failures.add("acted while idle");
                ok = false;
                break;
            }
            if (lastEndTick != Long.MIN_VALUE && tick - lastEndTick < cfg.actionCooldownTicks()) {
                failures.add("cooldown violated at tick " + tick);
                ok = false;
                break;
            }
            boolean opposite = (lastStarted == MoveAction.S_TAP && plan.action == MoveAction.W_TAP)
                    || (lastStarted == MoveAction.W_TAP && plan.action == MoveAction.S_TAP);
            if (opposite && tick - lastEndTick < cfg.directionFlipGuardTicks()) {
                failures.add("direction flipped inside the guard at tick " + tick);
                ok = false;
                break;
            }
            if (plan.action == MoveAction.S_TAP && !cfg.sTapEnabled) {
                failures.add("S-tap while disabled");
                ok = false;
                break;
            }
            if (plan.action == MoveAction.W_TAP && !cfg.wTapEnabled) {
                failures.add("W-tap while disabled");
                ok = false;
                break;
            }

            lastStarted = plan.action;
            lastStartTick = tick;
            activeRemaining = plan.durationTicks;
            lastEndTick = tick + plan.durationTicks;
            brain.onActionStarted(plan.action, plan.durationTicks, tick);
            actions++;
        }

        checks++;
        check("the simulation actually produced actions", actions > 20);
        check("simulation survived 20k ticks without breaking an invariant", ok);
        cfg.masterEnabled = true;
    }

    private static CombatSnapshot randomSnapshot(Random random, long tick) {
        CombatSnapshot s = new CombatSnapshot();
        s.tick = tick;
        s.hasTarget = random.nextInt(10) > 0;
        s.targetId = 7;
        s.distance = random.nextDouble() * 8.0D;
        s.closingSpeed = (random.nextDouble() - 0.4D) * 0.6D;
        s.targetSpeed = random.nextDouble() * 0.3D;
        s.targetClosingComponent = (random.nextDouble() - 0.5D) * 0.6D;
        s.targetFacingDot = random.nextDouble() * 2.0D - 1.0D;
        s.targetHurtTime = random.nextInt(11);
        s.targetSwinging = random.nextBoolean();
        s.targetSwingAgeTicks = s.targetSwinging ? random.nextInt(8) : -1;
        s.selfSprinting = random.nextBoolean();
        s.selfSpeed = random.nextDouble() * 0.3D;
        s.selfForwardInput = random.nextInt(3) - 1;
        s.selfOnGround = random.nextBoolean();
        s.selfHurtTime = random.nextInt(11);
        s.attackKeyHeld = random.nextBoolean();
        s.ticksSinceOurHit = random.nextInt(4) == 0 ? random.nextInt(14) : -1;
        s.ticksSinceOurAttack = random.nextInt(4) == 0 ? random.nextInt(14) : -1;
        s.ticksSinceHitTaken = random.nextInt(4) == 0 ? random.nextInt(14) : -1;
        s.lastHitWasSprint = random.nextBoolean();
        s.recentHitsLanded = random.nextInt(4);
        s.recentHitsTaken = random.nextInt(4);
        s.pingTicks = random.nextDouble() * 6.0D;
        s.latencyUncertaintyTicks = random.nextDouble() * 4.0D;
        s.latencyReliable = random.nextInt(5) > 0;
        return s;
    }

    // ------------------------------------------------------------------
    // Controller lifecycle (needs Minecraft on the classpath)
    // ------------------------------------------------------------------

    /**
     * Exercises {@code MovementController}'s action lifecycle, which is the code
     * that must leave inputs safe when the mod is switched off mid-action. Skipped
     * with a note when Minecraft is not on the classpath, so the rest of this
     * suite still runs under a plain JDK.
     */
    private static void testMovementControllerLifecycle() {
        section("movement controller lifecycle");
        try {
            CoreSettings cfg = defaults();
            cfg.setMinTapTicks(1);
            cfg.setMaxTapTicks(3);
            dev.paxiyl.pcp.client.MovementController controller =
                    new dev.paxiyl.pcp.client.MovementController(cfg);

            check("idle controller does not override", Float.isNaN(controller.forwardOverride()));
            check("idle controller reports no action", controller.activeAction() == MoveAction.NONE);

            MovementPlan plan = new MovementPlan();
            plan.set(MoveAction.W_TAP, 2, "test", 0.8D);
            check("action starts", controller.apply(plan, 10L));
            check("W-tap releases forward", controller.forwardOverride() == 0.0F);
            check("action is reported active", controller.activeAction() == MoveAction.W_TAP);

            MovementPlan competing = new MovementPlan();
            competing.set(MoveAction.S_TAP, 3, "competing", 0.9D);
            check("a running action is not pre-empted", !controller.apply(competing, 11L));
            check("the running action is unchanged", controller.activeAction() == MoveAction.W_TAP);

            // An over-long plan must be clamped by the controller as well.
            controller.releaseAll("reset for clamp test");
            MovementPlan tooLong = new MovementPlan();
            tooLong.set(MoveAction.S_TAP, 99, "too long", 0.9D);
            controller.apply(tooLong, 20L);
            int ticks = 0;
            while (controller.activeAction() != MoveAction.NONE && ticks < 50) {
                ticks++;
                controller.apply(null, 20L + ticks);
            }
            check("over-long plans are clamped by the controller", ticks <= cfg.maxTapTicks());
            check("controller ends with no override", Float.isNaN(controller.forwardOverride()));

            // Disabling mid-action must hand control straight back.
            MovementPlan active = new MovementPlan();
            active.set(MoveAction.S_TAP, 3, "mid-action", 0.9D);
            controller.apply(active, 100L);
            check("S-tap applies backward input", controller.forwardOverride() == -1.0F);
            controller.releaseAll("mod disabled");
            check("release restores player control", Float.isNaN(controller.forwardOverride()));
            check("release clears the action", controller.activeAction() == MoveAction.NONE);
            check("release is recorded", controller.lastRelease().contains("mod disabled"));

            // Counting down to completion also releases.
            MovementPlan shortTap = new MovementPlan();
            shortTap.set(MoveAction.W_TAP, 1, "short", 0.5D);
            controller.apply(shortTap, 200L);
            controller.apply(null, 201L);
            check("a completed tap releases itself", controller.activeAction() == MoveAction.NONE);
            check("no override after completion", Float.isNaN(controller.forwardOverride()));
        } catch (NoClassDefFoundError e) {
            System.out.println("   skipped: Minecraft classes not on the classpath");
        }
    }
}
