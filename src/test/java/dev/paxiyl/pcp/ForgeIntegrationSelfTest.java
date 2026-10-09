package dev.paxiyl.pcp;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import dev.paxiyl.pcp.client.AdaptiveMovementInput;
import dev.paxiyl.pcp.client.DebugOverlay;
import dev.paxiyl.pcp.client.HitObserver;
import dev.paxiyl.pcp.client.KeyBindings;
import dev.paxiyl.pcp.client.MovementController;
import dev.paxiyl.pcp.client.ProfileStore;
import dev.paxiyl.pcp.client.SafetyGuard;
import dev.paxiyl.pcp.config.PcpConfig;
import dev.paxiyl.pcp.core.CombatSnapshot;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.KnockbackObservation;
import dev.paxiyl.pcp.core.KnockbackProfile;
import dev.paxiyl.pcp.core.MoveAction;
import dev.paxiyl.pcp.core.MovementPlan;
import net.minecraft.util.MovementInput;

/**
 * Head-less integration tests against the real Forge and Minecraft classes.
 *
 * <p>Unlike {@code CoreSelfTest} this needs the Minecraft classpath, because the
 * whole point is to exercise code that talks to Forge: the configuration system,
 * the real {@code MovementInput} the movement wrapper delegates to, profile file
 * IO, and the null-safety paths. It deliberately does <em>not</em> need a running
 * game, a window or an OpenGL context, so it is the furthest the mod can be
 * exercised without launching Minecraft.</p>
 */
public final class ForgeIntegrationSelfTest {

    private static int checks;
    private static final List<String> failures = new ArrayList<String>();

    public static void main(String[] args) throws Exception {
        File sandbox = new File(System.getProperty("java.io.tmpdir"),
                "pcp-integration-" + System.nanoTime());
        if (!sandbox.mkdirs()) {
            System.out.println("could not create sandbox directory");
            System.exit(1);
        }
        primeFmlHome(sandbox);
        try {
            testConfigRoundTrip(sandbox);
            testConfigClampsHandEdits(sandbox);
            testProfileStore(sandbox);
            testMovementInputDelegation();
            testKeyBindings();
            testSafetyGuardNullClient();
            testHitObserverNullSafety();
            testOverlayComposition(sandbox);
        } finally {
            deleteTree(sandbox);
        }

        System.out.println();
        System.out.println("integration checks run: " + checks + ", failures: " + failures.size());
        for (int i = 0; i < failures.size(); i++) {
            System.out.println("  FAIL " + failures.get(i));
        }
        if (failures.isEmpty()) {
            System.out.println("ALL FORGE INTEGRATION TESTS PASSED");
        }
        System.exit(failures.isEmpty() ? 0 : 1);
    }

    /**
     * Forge's {@code Configuration} resolves paths through
     * {@code FMLInjectionData.data()[6]}, which the game populates during
     * launch. Nothing here launches the game, so the test harness sets that one
     * static directly. This primes the environment Forge expects; it does not
     * stand in for any of the code under test.
     */
    private static void primeFmlHome(File home) {
        try {
            Class<?> injection = Class.forName("net.minecraftforge.fml.relauncher.FMLInjectionData");
            java.lang.reflect.Field field = injection.getDeclaredField("minecraftHome");
            field.setAccessible(true);
            field.set(null, home);
            setIfPresent(injection, "mccversion", "1.8.9");
            setIfPresent(injection, "major", "11");
            setIfPresent(injection, "minor", "15");
            setIfPresent(injection, "rev", "1");
            setIfPresent(injection, "build", "2318");
            setIfPresent(injection, "mcpversion", "9.19");
        } catch (Exception e) {
            failures.add("could not prime FMLInjectionData: " + e);
            checks++;
        }
    }

    private static void setIfPresent(Class<?> owner, String name, String value) {
        try {
            java.lang.reflect.Field field = owner.getDeclaredField(name);
            field.setAccessible(true);
            if (field.get(null) == null) {
                field.set(null, value);
            }
        } catch (Exception ignored) {
            // Optional: only data()[6] is actually required.
        }
    }

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

    // ------------------------------------------------------------------
    // Forge Configuration
    // ------------------------------------------------------------------

    private static void testConfigRoundTrip(File sandbox) {
        section("Forge config: defaults, write, re-read");
        File file = new File(sandbox, "pcp.cfg");
        CoreSettings settings = new CoreSettings();
        PcpConfig config = new PcpConfig(settings);
        config.load(file);

        check("config file created on first load", file.isFile());
        check("config file is not empty", file.length() > 0L);

        // Documented defaults must survive a real load through Forge.
        check("master default", settings.masterEnabled);
        check("w-tap default", settings.wTapEnabled);
        check("s-tap default", settings.sTapEnabled);
        check("trade default", settings.tradeTimingEnabled);
        check("spacing default", settings.spacingEnabled);
        check("overlay default off", !settings.debugOverlay);
        check("min tap default", settings.minTapTicks() == 1);
        check("max tap default", settings.maxTapTicks() == 4);
        check("cooldown default", settings.actionCooldownTicks() == 6);
        check("flip guard default", settings.directionFlipGuardTicks() == 8);
        check("trade hold default", settings.maxTradeDelayTicks() == 3);
        near("effective range default", 3.0D, settings.effectiveRange(), 1.0E-6D);
        near("combo band default", 0.72D, settings.comboBandFraction(), 1.0E-6D);
        near("danger close default", 0.55D, settings.dangerCloseFraction(), 1.0E-6D);
        check("prediction default", settings.predictionTicks() == 3);
        near("max target distance default", 7.0D, settings.maxTargetDistance(), 1.0E-6D);
        near("learning rate default", 0.25D, settings.learningRate(), 1.0E-6D);
        near("min confidence default", 0.35D, settings.minConfidence(), 1.0E-6D);
        check("target timeout default", settings.targetTimeoutTicks() == 40);
        check("stuck guard default", settings.stateStuckTicks() == 120);
        check("players only default", config.targetPlayersOnly);
        check("persist profiles default", config.persistProfiles);
        check("chat feedback default", config.chatFeedback);
        check("overlay corner default", config.overlayCorner == 0);

        // Change everything, save, and re-read with a fresh settings object.
        settings.masterEnabled = false;
        settings.wTapEnabled = false;
        settings.debugOverlay = true;
        settings.setMinTapTicks(2);
        settings.setMaxTapTicks(5);
        settings.setActionCooldownTicks(9);
        settings.setMaxTradeDelayTicks(1);
        settings.setEffectiveRange(3.25D);
        settings.setLearningRate(0.6D);
        settings.setMinConfidence(0.5D);
        settings.setPredictionTicks(4);
        config.overlayCorner = 3;
        config.chatFeedback = false;
        config.save();

        CoreSettings reread = new CoreSettings();
        PcpConfig reloaded = new PcpConfig(reread);
        reloaded.load(file);

        check("booleans persisted", !reread.masterEnabled && !reread.wTapEnabled && reread.debugOverlay);
        check("min tap persisted", reread.minTapTicks() == 2);
        check("max tap persisted", reread.maxTapTicks() == 5);
        check("cooldown persisted", reread.actionCooldownTicks() == 9);
        check("trade hold persisted", reread.maxTradeDelayTicks() == 1);
        near("range persisted", 3.25D, reread.effectiveRange(), 1.0E-6D);
        near("learning rate persisted", 0.6D, reread.learningRate(), 1.0E-6D);
        near("min confidence persisted", 0.5D, reread.minConfidence(), 1.0E-6D);
        check("prediction persisted", reread.predictionTicks() == 4);
        check("overlay corner persisted", reloaded.overlayCorner == 3);
        check("chat feedback persisted", !reloaded.chatFeedback);
        check("config file path exposed", reloaded.configFile() != null);

        // reload() must pick up on-disk changes without a restart.
        reread.masterEnabled = true;
        reloaded.reload();
        check("reload restores the on-disk value", !reread.masterEnabled);
    }

    private static void testConfigClampsHandEdits(File sandbox) {
        section("Forge config: hand-edited values are clamped");
        File file = new File(sandbox, "pcp-edited.cfg");
        CoreSettings first = new CoreSettings();
        new PcpConfig(first).load(file);

        // Rewrite the file the way an impatient human would.
        String text = readAll(file);
        text = text.replaceAll("D:effectiveRange=[0-9.]+", "D:effectiveRange=99.0");
        text = text.replaceAll("I:maxTapTicks=[0-9]+", "I:maxTapTicks=500");
        text = text.replaceAll("I:maxTradeDelayTicks=[0-9]+", "I:maxTradeDelayTicks=120");
        text = text.replaceAll("D:minConfidence=[0-9.]+", "D:minConfidence=5.0");
        writeAll(file, text);

        CoreSettings loaded = new CoreSettings();
        new PcpConfig(loaded).load(file);

        check("absurd range clamped", loaded.effectiveRange() <= 4.5D);
        check("absurd tap length clamped", loaded.maxTapTicks() <= 10);
        check("absurd attack hold clamped", loaded.maxTradeDelayTicks() <= 6);
        check("absurd confidence clamped", loaded.minConfidence() <= 0.95D);
        check("bands still ordered", loaded.dangerCloseFraction() < loaded.comboBandFraction());
    }

    // ------------------------------------------------------------------
    // Profile persistence
    // ------------------------------------------------------------------

    private static void testProfileStore(File sandbox) {
        section("profile store: real file IO");
        ProfileStore store = new ProfileStore(sandbox);
        KnockbackProfile profile = new KnockbackProfile();
        for (int i = 0; i < 12; i++) {
            profile.record(new KnockbackObservation(2.2D, 0.38D, 1.85D + (i % 3) * 0.01D, true, 1, true));
        }
        double learned = profile.separationGain(true);

        check("save writes a file", store.save(profile, "test.server"));
        check("file is where it says it is", store.fileFor("test.server").isFile());

        KnockbackProfile restored = new KnockbackProfile();
        check("load reports success", store.load(restored, "test.server"));
        near("learned value survived the round trip", learned, restored.separationGain(true), 0.01D);
        check("sample count survived", restored.sampleCount(true) == profile.sampleCount(true));
        check("server key set on load", "test.server".equals(restored.serverKey()));

        KnockbackProfile missing = new KnockbackProfile();
        check("loading an unknown server is not an error", !store.load(missing, "never.seen"));
        check("unknown server still gets its key", "never.seen".equals(missing.serverKey()));
        check("unknown server keeps the prior", !missing.isMeasured(true));

        check("delete removes the file", store.delete("test.server"));
        check("file really gone", !store.fileFor("test.server").isFile());
        check("deleting twice is harmless", !store.delete("test.server"));
    }

    // ------------------------------------------------------------------
    // The movement wrapper, against the real MovementInput
    // ------------------------------------------------------------------

    /**
     * The most important integration check in here: the wrapper must be
     * transparent when idle, must report the player's true intent, and must
     * hand control straight back when an action is released.
     */
    private static void testMovementInputDelegation() {
        section("movement input wrapper against real MovementInput");
        CoreSettings settings = new CoreSettings();
        MovementController controller = new MovementController(settings);

        // A stand-in for MovementInputFromOptions: same class, scripted values.
        final MovementInput player = new MovementInput();
        player.moveForward = 1.0F;
        player.moveStrafe = 0.5F;
        player.jump = true;
        player.sneak = false;

        AdaptiveMovementInput wrapper = new AdaptiveMovementInput(player, controller);
        check("wrapper is a MovementInput", wrapper instanceof MovementInput);
        check("delegate is exposed", wrapper.delegate() == player);

        wrapper.updatePlayerMoveState();
        near("idle wrapper passes forward through", 1.0F, wrapper.moveForward, 1.0E-6D);
        near("idle wrapper passes strafe through", 0.5F, wrapper.moveStrafe, 1.0E-6D);
        check("idle wrapper passes jump through", wrapper.jump);
        check("idle wrapper passes sneak through", !wrapper.sneak);

        CombatSnapshot snapshot = new CombatSnapshot();
        controller.fillSnapshot(snapshot);
        near("player's real forward intent recorded", 1.0D, snapshot.selfForwardInput, 1.0E-6D);
        near("player's real strafe intent recorded", 0.5D, snapshot.selfStrafeInput, 1.0E-6D);

        // W-tap: forward must be released, everything else untouched.
        MovementPlan wtap = new MovementPlan();
        wtap.set(MoveAction.W_TAP, 2, "test", 0.9D);
        check("action started", controller.apply(wtap, 1L));
        wrapper.updatePlayerMoveState();
        near("W-tap releases forward", 0.0F, wrapper.moveForward, 1.0E-6D);
        near("W-tap leaves strafe alone", 0.5F, wrapper.moveStrafe, 1.0E-6D);
        check("W-tap leaves jump alone", wrapper.jump);
        controller.fillSnapshot(snapshot);
        near("intent still reports what the player asked for", 1.0D, snapshot.selfForwardInput, 1.0E-6D);

        // Releasing mid-action restores control on the next update.
        controller.releaseAll("test release");
        wrapper.updatePlayerMoveState();
        near("release restores the player's forward input", 1.0F, wrapper.moveForward, 1.0E-6D);

        // S-tap applies bounded backward input.
        MovementPlan stap = new MovementPlan();
        stap.set(MoveAction.S_TAP, 2, "test", 0.9D);
        controller.apply(stap, 10L);
        wrapper.updatePlayerMoveState();
        near("S-tap applies backward input", -1.0F, wrapper.moveForward, 1.0E-6D);

        // Sneak scaling must be mirrored so an override cannot outrun the
        // player's own input.
        player.sneak = true;
        wrapper.updatePlayerMoveState();
        near("override is sneak-scaled like vanilla", -0.3F, wrapper.moveForward, 1.0E-4D);
        player.sneak = false;
        controller.releaseAll("done");

        // A negative player intent must survive untouched when idle.
        player.moveForward = -1.0F;
        wrapper.updatePlayerMoveState();
        near("backward input passes through when idle", -1.0F, wrapper.moveForward, 1.0E-6D);
    }

    // ------------------------------------------------------------------
    // Misc Forge-touching pieces
    // ------------------------------------------------------------------

    private static void testKeyBindings() {
        section("key bindings");
        KeyBindings keys = new KeyBindings();
        check("master key has a default", KeyBindings.bound(keys.toggleMaster));
        check("overlay key has a default", KeyBindings.bound(keys.toggleOverlay));
        check("suspend key has a default", KeyBindings.bound(keys.suspend));
        check("config key has a default", KeyBindings.bound(keys.openConfig));
        check("module keys start unbound", !KeyBindings.bound(keys.toggleWTap));
        check("override key starts unbound", !KeyBindings.bound(keys.manualOverride));
        check("an unbound key is never treated as held", !KeyBindings.heldSafely(keys.manualOverride));
        check("null key is never treated as bound", !KeyBindings.bound(null));
        check("keys share one category",
                KeyBindings.CATEGORY.equals(keys.toggleMaster.getKeyCategory()));
    }

    private static void testSafetyGuardNullClient() {
        section("safety guard");
        SafetyGuard guard = new SafetyGuard();
        check("a null client blocks automation", guard.check(null) != null);
        check("the block reason is reported", guard.lastBlockReason().length() > 0);
        guard.setSuspendedByPlayer(true);
        check("player suspension is remembered", guard.suspendedByPlayer());
        guard.setSuspendedByPlayer(false);
        check("suspension clears", !guard.suspendedByPlayer());
    }

    private static void testHitObserverNullSafety() {
        section("hit observer null safety");
        HitObserver observer = new HitObserver();
        CombatSnapshot snapshot = new CombatSnapshot();
        // A null player happens between world loads; it must not throw.
        observer.update(null, null, null, snapshot, 1L);
        check("no hits recorded from nothing", observer.confirmedHits() == 0);
        check("nothing is awaiting confirmation", !observer.awaitingConfirmation());
        observer.onAttackSent(null, true, 2.5D, 5L);
        check("an attack with no target is still tracked", observer.awaitingConfirmation());
        observer.reset("test");
        check("reset clears the pending attack", !observer.awaitingConfirmation());
    }

    private static void testOverlayComposition(File sandbox) {
        section("overlay composition");
        CoreSettings settings = new CoreSettings();
        PcpConfig config = new PcpConfig(settings);
        config.load(new File(sandbox, "overlay.cfg"));
        DebugOverlay overlay = new DebugOverlay(config);

        // Composition must be safe without any GL context; only render() draws.
        overlay.begin();
        for (int i = 0; i < 40; i++) {
            overlay.add("line " + i);
        }
        overlay.add(null);
        check("overlay accepts more lines than it shows without failing", true);

        // render() with a null client must be a no-op rather than a crash.
        overlay.render(null);
        check("render with no client is a no-op", true);
    }

    // ------------------------------------------------------------------
    // Tiny file helpers
    // ------------------------------------------------------------------

    private static String readAll(File file) {
        java.io.BufferedReader reader = null;
        StringBuilder sb = new StringBuilder();
        try {
            reader = new java.io.BufferedReader(new java.io.FileReader(file));
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
        } catch (java.io.IOException e) {
            failures.add("could not read " + file);
            checks++;
        } finally {
            try {
                if (reader != null) {
                    reader.close();
                }
            } catch (java.io.IOException ignored) {
                // nothing useful to do
            }
        }
        return sb.toString();
    }

    private static void writeAll(File file, String text) {
        java.io.Writer writer = null;
        try {
            writer = new java.io.BufferedWriter(new java.io.FileWriter(file));
            writer.write(text);
        } catch (java.io.IOException e) {
            failures.add("could not write " + file);
            checks++;
        } finally {
            try {
                if (writer != null) {
                    writer.close();
                }
            } catch (java.io.IOException ignored) {
                // nothing useful to do
            }
        }
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) {
            return;
        }
        File[] children = file.listFiles();
        if (children != null) {
            for (int i = 0; i < children.length; i++) {
                deleteTree(children[i]);
            }
        }
        if (!file.delete()) {
            file.deleteOnExit();
        }
    }
}
