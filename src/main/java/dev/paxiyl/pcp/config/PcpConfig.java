package dev.paxiyl.pcp.config;

import java.io.File;

import dev.paxiyl.pcp.core.CoreSettings;
import net.minecraftforge.common.config.Configuration;
import net.minecraftforge.common.config.Property;

/**
 * Config-file backing for {@link CoreSettings} plus the few client-only
 * options.
 *
 * <p>Uses Forge's {@link Configuration} so the file is a plain, hand-editable
 * {@code config/pcp.cfg}. Every value is pushed through the clamping setters on
 * {@code CoreSettings}, so editing the file by hand cannot put the controller
 * outside its safe bounds.</p>
 */
public final class PcpConfig {

    public static final String CAT_GENERAL = "general";
    public static final String CAT_MOVEMENT = "movement";
    public static final String CAT_SPACING = "spacing";
    public static final String CAT_LEARNING = "learning";
    public static final String CAT_DEBUG = "debug";

    private final CoreSettings core;
    private Configuration cfg;

    // ---- client-only options ----
    /** Only other players are considered opponents. */
    public boolean targetPlayersOnly = true;
    /** 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right. */
    public int overlayCorner = 0;
    public int overlayMargin = 3;
    /** Persist the learned profile per server between sessions. */
    public boolean persistProfiles = true;
    /** Print short confirmations in chat when toggles change. */
    public boolean chatFeedback = true;

    public PcpConfig(CoreSettings core) {
        this.core = core;
    }

    public CoreSettings core() {
        return this.core;
    }

    public void load(File file) {
        this.cfg = new Configuration(file);
        this.cfg.load();
        read();
        if (this.cfg.hasChanged()) {
            this.cfg.save();
        }
    }

    /** Re-reads the file into memory, for {@code /pcp reload}. */
    public void reload() {
        if (this.cfg == null) {
            return;
        }
        this.cfg.load();
        read();
    }

    private void read() {
        Configuration c = this.cfg;

        this.core.masterEnabled = c.get(CAT_GENERAL, "masterEnabled", true,
                "Master switch. When false nothing is controlled and all inputs stay the player's.").getBoolean();
        this.core.wTapEnabled = c.get(CAT_GENERAL, "wTapAssist", true,
                "Allow brief forward releases for sprint resets.").getBoolean();
        this.core.sTapEnabled = c.get(CAT_GENERAL, "sTapAssist", true,
                "Allow brief backward corrections to restore spacing.").getBoolean();
        this.core.tradeTimingEnabled = c.get(CAT_GENERAL, "tradeTimingAssist", true,
                "Allow the mod to hold a requested attack for a few ticks to pick a better window. "
                        + "It never creates attacks and never drops them.").getBoolean();
        this.core.spacingEnabled = c.get(CAT_GENERAL, "spacingAssist", true,
                "Enable the spacing model that drives backward corrections.").getBoolean();
        this.targetPlayersOnly = c.get(CAT_GENERAL, "targetPlayersOnly", true,
                "Only treat other players as opponents.").getBoolean();
        this.chatFeedback = c.get(CAT_GENERAL, "chatFeedback", true,
                "Print one-line confirmations in chat when something is toggled.").getBoolean();

        this.core.setMinTapTicks(c.get(CAT_MOVEMENT, "minTapTicks", 1,
                "Shortest movement tap, in ticks (1 tick = 50 ms).", 1, 10).getInt());
        this.core.setMaxTapTicks(c.get(CAT_MOVEMENT, "maxTapTicks", 4,
                "Longest movement tap, in ticks. Hard cap on how long any input is held.", 1, 10).getInt());
        this.core.setActionCooldownTicks(c.get(CAT_MOVEMENT, "actionCooldownTicks", 6,
                "Ticks after an action ends before another may start.", 0, 60).getInt());
        this.core.setDirectionFlipGuardTicks(c.get(CAT_MOVEMENT, "directionFlipGuardTicks", 8,
                "Minimum ticks between two actions that pull in opposite directions. "
                        + "Stops the controller from alternating forward and back.", 0, 60).getInt());
        this.core.setMaxTradeDelayTicks(c.get(CAT_MOVEMENT, "maxTradeDelayTicks", 3,
                "Hardest cap on how long a requested attack may be held, in ticks. 0 disables holding.",
                0, 6).getInt());

        this.core.setEffectiveRange(c.get(CAT_SPACING, "effectiveRange", 3.0D,
                "Effective attack range estimate for this server, in blocks. Vanilla 1.8.9 is about 3.0; "
                        + "servers and anti-cheats change the practical value.", 2.0D, 4.5D).getDouble());
        this.core.setComboBandFraction(c.get(CAT_SPACING, "comboBandFraction", 0.72D,
                "Fraction of effective range treated as the favourable combo band.", 0.4D, 0.95D).getDouble());
        this.core.setDangerCloseFraction(c.get(CAT_SPACING, "dangerCloseFraction", 0.55D,
                "Below this fraction of effective range we are in a dangerous close-range trade.",
                0.2D, 0.9D).getDouble());
        this.core.setPredictionTicks(c.get(CAT_SPACING, "predictionTicks", 3,
                "How far ahead the spacing model projects the gap, in ticks.", 1, 10).getInt());
        this.core.setMaxTargetDistance(c.get(CAT_SPACING, "maxTargetDistance", 7.0D,
                "Opponents beyond this distance are ignored entirely, in blocks.", 3.0D, 16.0D).getDouble());

        this.core.setLearningRate(c.get(CAT_LEARNING, "learningAggressiveness", 0.25D,
                "0.05 follows the long-run average, 1.0 follows the last few hits.", 0.05D, 1.0D).getDouble());
        this.core.setMinConfidence(c.get(CAT_LEARNING, "minConfidence", 0.35D,
                "Confidence the learned knockback profile must reach before automatic corrections run. "
                        + "A minimum-length W-tap is still allowed below it; S-tap and attack holding are not.",
                0.0D, 0.95D).getDouble());
        this.core.setTargetTimeoutTicks(c.get(CAT_LEARNING, "targetTimeoutTicks", 40,
                "Ticks an opponent may go unseen before the engagement is dropped.", 5, 200).getInt());
        this.core.setStateStuckTicks(c.get(CAT_LEARNING, "stateStuckTicks", 120,
                "Any state held longer than this without new evidence falls back to Idle.", 20, 600).getInt());
        this.persistProfiles = c.get(CAT_LEARNING, "persistProfiles", true,
                "Save the learned profile per server under config/pcp/profiles.").getBoolean();

        this.core.debugOverlay = c.get(CAT_DEBUG, "debugOverlay", false,
                "Show the diagnostic overlay.").getBoolean();
        this.overlayCorner = c.get(CAT_DEBUG, "overlayCorner", 0,
                "Overlay corner: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.", 0, 3).getInt();
        this.overlayMargin = c.get(CAT_DEBUG, "overlayMargin", 3,
                "Overlay margin from the screen edge, in pixels.", 0, 80).getInt();
    }

    /** Writes the in-memory values back out and saves. */
    public void save() {
        if (this.cfg == null) {
            return;
        }
        set(CAT_GENERAL, "masterEnabled", this.core.masterEnabled);
        set(CAT_GENERAL, "wTapAssist", this.core.wTapEnabled);
        set(CAT_GENERAL, "sTapAssist", this.core.sTapEnabled);
        set(CAT_GENERAL, "tradeTimingAssist", this.core.tradeTimingEnabled);
        set(CAT_GENERAL, "spacingAssist", this.core.spacingEnabled);
        set(CAT_GENERAL, "targetPlayersOnly", this.targetPlayersOnly);
        set(CAT_GENERAL, "chatFeedback", this.chatFeedback);

        set(CAT_MOVEMENT, "minTapTicks", this.core.minTapTicks());
        set(CAT_MOVEMENT, "maxTapTicks", this.core.maxTapTicks());
        set(CAT_MOVEMENT, "actionCooldownTicks", this.core.actionCooldownTicks());
        set(CAT_MOVEMENT, "directionFlipGuardTicks", this.core.directionFlipGuardTicks());
        set(CAT_MOVEMENT, "maxTradeDelayTicks", this.core.maxTradeDelayTicks());

        set(CAT_SPACING, "effectiveRange", this.core.effectiveRange());
        set(CAT_SPACING, "comboBandFraction", this.core.comboBandFraction());
        set(CAT_SPACING, "dangerCloseFraction", this.core.dangerCloseFraction());
        set(CAT_SPACING, "predictionTicks", this.core.predictionTicks());
        set(CAT_SPACING, "maxTargetDistance", this.core.maxTargetDistance());

        set(CAT_LEARNING, "learningAggressiveness", this.core.learningRate());
        set(CAT_LEARNING, "minConfidence", this.core.minConfidence());
        set(CAT_LEARNING, "targetTimeoutTicks", this.core.targetTimeoutTicks());
        set(CAT_LEARNING, "stateStuckTicks", this.core.stateStuckTicks());
        set(CAT_LEARNING, "persistProfiles", this.persistProfiles);

        set(CAT_DEBUG, "debugOverlay", this.core.debugOverlay);
        set(CAT_DEBUG, "overlayCorner", this.overlayCorner);
        set(CAT_DEBUG, "overlayMargin", this.overlayMargin);

        if (this.cfg.hasChanged()) {
            this.cfg.save();
        }
    }

    private void set(String category, String key, boolean value) {
        Property p = this.cfg.getCategory(category).get(key);
        if (p != null) {
            p.set(value);
        }
    }

    private void set(String category, String key, int value) {
        Property p = this.cfg.getCategory(category).get(key);
        if (p != null) {
            p.set(value);
        }
    }

    private void set(String category, String key, double value) {
        Property p = this.cfg.getCategory(category).get(key);
        if (p != null) {
            p.set(value);
        }
    }

    public File configFile() {
        return this.cfg == null ? null : this.cfg.getConfigFile();
    }
}
