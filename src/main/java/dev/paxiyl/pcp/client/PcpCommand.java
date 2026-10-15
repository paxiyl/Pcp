package dev.paxiyl.pcp.client;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import dev.paxiyl.pcp.config.PcpConfig;
import dev.paxiyl.pcp.core.CoreSettings;
import dev.paxiyl.pcp.core.KnockbackProfile;
import dev.paxiyl.pcp.core.LatencyModel;
import dev.paxiyl.pcp.core.ReachEstimator;
import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.BlockPos;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;

/**
 * {@code /pcp} - the full control surface without a single key bound.
 *
 * <p>This exists mainly for PojavLauncher and other touch setups, where
 * on-screen buttons are limited: every toggle, every numeric setting, the
 * profile reset and the config screen are all reachable from chat.</p>
 */
public final class PcpCommand extends CommandBase {

    private final PcpClient client;
    private final PcpConfig config;
    private final CoreSettings settings;

    public PcpCommand(PcpClient client) {
        this.client = client;
        this.config = client.config();
        this.settings = client.config().core();
    }

    @Override
    public String getCommandName() {
        return "pcp";
    }

    @Override
    public List<String> getCommandAliases() {
        return Arrays.asList("spacing");
    }

    @Override
    public String getCommandUsage(ICommandSender sender) {
        return "/pcp [status|on|off|preset|autoreach|wtap|stap|trade|spacing|overlay|reach|learn|conf|taps|cooldown|delay|reset|reload|gui]";
    }

    @Override
    public int getRequiredPermissionLevel() {
        return 0;
    }

    @Override
    public boolean canCommandSenderUseCommand(ICommandSender sender) {
        return true;
    }

    @Override
    public List<String> addTabCompletionOptions(ICommandSender sender, String[] args, BlockPos pos) {
        if (args.length == 1) {
            return getListOfStringsMatchingLastWord(args, "status", "on", "off", "preset", "autoreach",
                    "wtap", "stap", "trade", "spacing", "overlay", "reach", "learn", "conf", "taps",
                    "cooldown", "delay", "reset", "reload", "gui", "help");
        }
        if (args.length == 2 && "preset".equalsIgnoreCase(args[0])) {
            return getListOfStringsMatchingLastWord(args, "safe", "balanced", "aggressive");
        }
        if (args.length == 2) {
            String head = args[0].toLowerCase();
            if ("autoreach".equals(head)) {
                return getListOfStringsMatchingLastWord(args, "on", "off", "toggle");
            }
            if ("wtap".equals(head) || "stap".equals(head) || "trade".equals(head)
                    || "spacing".equals(head) || "overlay".equals(head)) {
                return getListOfStringsMatchingLastWord(args, "on", "off", "toggle");
            }
        }
        return new ArrayList<String>();
    }

    @Override
    public void processCommand(ICommandSender sender, String[] args) {
        if (args.length == 0 || "status".equalsIgnoreCase(args[0])) {
            status(sender);
            return;
        }

        String head = args[0].toLowerCase();

        if ("help".equals(head)) {
            help(sender);
            return;
        }
        if ("on".equals(head) || "off".equals(head)) {
            this.settings.masterEnabled = "on".equals(head);
            if (!this.settings.masterEnabled) {
                this.client.shutDownControls("disabled from command");
            }
            saveAndReply(sender, "Assist " + state(this.settings.masterEnabled));
            return;
        }
        if ("preset".equals(head)) {
            if (args.length < 2) {
                reply(sender, "Current preset: " + this.settings.preset().id()
                        + ". Usage: /pcp preset <safe|balanced|aggressive>");
                return;
            }
            CoreSettings.Preset chosen = CoreSettings.parsePreset(args[1]);
            if (chosen == null) {
                reply(sender, EnumChatFormatting.RED + "Unknown preset. Pick safe, balanced or aggressive.");
                return;
            }
            this.settings.applyPreset(chosen);
            this.client.shutDownControls("preset changed");
            saveAndReply(sender, "Preset " + chosen.id() + " applied: taps "
                    + this.settings.minTapTicks() + "-" + this.settings.maxTapTicks() + "t, cooldown "
                    + this.settings.actionCooldownTicks() + "t, hold max "
                    + this.settings.maxTradeDelayTicks() + "t, min confidence "
                    + String.format("%.0f%%", this.settings.minConfidence() * 100.0D));
            return;
        }
        if ("autoreach".equals(head)) {
            this.settings.autoReach = flag(args, this.settings.autoReach);
            ReachEstimator r = this.client.brain().reach();
            saveAndReply(sender, "Auto-learned reach " + state(this.settings.autoReach)
                    + " (" + r.describe() + ")");
            return;
        }
        if ("wtap".equals(head)) {
            this.settings.wTapEnabled = flag(args, this.settings.wTapEnabled);
            this.client.movement().releaseAll("w-tap setting changed");
            saveAndReply(sender, "W-tap " + state(this.settings.wTapEnabled));
            return;
        }
        if ("stap".equals(head)) {
            this.settings.sTapEnabled = flag(args, this.settings.sTapEnabled);
            this.client.movement().releaseAll("s-tap setting changed");
            saveAndReply(sender, "S-tap " + state(this.settings.sTapEnabled));
            return;
        }
        if ("trade".equals(head)) {
            this.settings.tradeTimingEnabled = flag(args, this.settings.tradeTimingEnabled);
            saveAndReply(sender, "Trade timing " + state(this.settings.tradeTimingEnabled));
            return;
        }
        if ("spacing".equals(head)) {
            this.settings.spacingEnabled = flag(args, this.settings.spacingEnabled);
            saveAndReply(sender, "Spacing assist " + state(this.settings.spacingEnabled));
            return;
        }
        if ("overlay".equals(head)) {
            this.settings.debugOverlay = flag(args, this.settings.debugOverlay);
            saveAndReply(sender, "Overlay " + state(this.settings.debugOverlay));
            return;
        }
        if ("reach".equals(head)) {
            if (args.length < 2) {
                reply(sender, String.format("Range in use %.2f blocks (%s), configured %.2f",
                        this.settings.effectiveRange(),
                        this.settings.usingLearnedRange() ? "measured" : "configured",
                        this.settings.configuredRange()));
                return;
            }
            this.settings.setEffectiveRange(parseDoubleSafe(args[1], this.settings.configuredRange()));
            saveAndReply(sender, String.format("Configured range: %.2f blocks (clamped 2.0-4.5)%s",
                    this.settings.configuredRange(),
                    this.settings.usingLearnedRange()
                            ? " - not in use while autoreach is on, measured "
                                    + String.format("%.2f", this.settings.effectiveRange())
                            : ""));
            return;
        }
        if ("learn".equals(head)) {
            if (args.length < 2) {
                reply(sender, String.format("Learning aggressiveness: %.2f", this.settings.learningRate()));
                return;
            }
            this.settings.setLearningRate(parseDoubleSafe(args[1], this.settings.learningRate()));
            saveAndReply(sender, String.format("Learning aggressiveness: %.2f (clamped 0.05-1.0)",
                    this.settings.learningRate()));
            return;
        }
        if ("conf".equals(head)) {
            if (args.length < 2) {
                reply(sender, String.format("Minimum confidence: %.2f", this.settings.minConfidence()));
                return;
            }
            this.settings.setMinConfidence(parseDoubleSafe(args[1], this.settings.minConfidence()));
            saveAndReply(sender, String.format("Minimum confidence: %.2f", this.settings.minConfidence()));
            return;
        }
        if ("taps".equals(head)) {
            if (args.length < 3) {
                reply(sender, "Tap bounds: " + this.settings.minTapTicks() + "-"
                        + this.settings.maxTapTicks() + " ticks. Usage: /pcp taps <min> <max>");
                return;
            }
            this.settings.setMinTapTicks((int) parseDoubleSafe(args[1], this.settings.minTapTicks()));
            this.settings.setMaxTapTicks((int) parseDoubleSafe(args[2], this.settings.maxTapTicks()));
            saveAndReply(sender, "Tap bounds: " + this.settings.minTapTicks() + "-"
                    + this.settings.maxTapTicks() + " ticks");
            return;
        }
        if ("cooldown".equals(head)) {
            if (args.length < 2) {
                reply(sender, "Action cooldown: " + this.settings.actionCooldownTicks() + " ticks");
                return;
            }
            this.settings.setActionCooldownTicks((int) parseDoubleSafe(args[1], this.settings.actionCooldownTicks()));
            saveAndReply(sender, "Action cooldown: " + this.settings.actionCooldownTicks() + " ticks");
            return;
        }
        if ("delay".equals(head)) {
            if (args.length < 2) {
                reply(sender, "Max attack hold: " + this.settings.maxTradeDelayTicks() + " ticks");
                return;
            }
            this.settings.setMaxTradeDelayTicks((int) parseDoubleSafe(args[1], this.settings.maxTradeDelayTicks()));
            saveAndReply(sender, "Max attack hold: " + this.settings.maxTradeDelayTicks() + " ticks (cap 6)");
            return;
        }
        if ("reset".equals(head)) {
            this.client.resetLearnedProfile();
            reply(sender, "Learned knockback profile cleared for " + this.client.serverKey()
                    + ". Estimates fall back to the vanilla-reference prior until new hits are measured.");
            return;
        }
        if ("reload".equals(head)) {
            this.config.reload();
            this.client.shutDownControls("config reloaded");
            reply(sender, "Config reloaded from disk.");
            return;
        }
        if ("gui".equals(head)) {
            this.client.requestConfigScreen();
            return;
        }

        reply(sender, EnumChatFormatting.RED + "Unknown option. " + getCommandUsage(sender));
    }

    private void status(ICommandSender sender) {
        LatencyModel lat = this.client.brain().latency();
        KnockbackProfile kb = this.client.brain().knockback();

        reply(sender, EnumChatFormatting.AQUA + "PCP " + EnumChatFormatting.RESET
                + "master " + state(this.settings.masterEnabled)
                + ", wtap " + state(this.settings.wTapEnabled)
                + ", stap " + state(this.settings.sTapEnabled)
                + ", trade " + state(this.settings.tradeTimingEnabled)
                + ", spacing " + state(this.settings.spacingEnabled));
        reply(sender, "state " + this.client.brain().state().label()
                + " | zone " + this.client.brain().zone().label()
                + " | " + this.client.guard().lastBlockReason());
        reply(sender, String.format("preset %s | range %.2f (%s), combo %.2f, danger %.2f, taps %d-%dt, hold %dt",
                this.settings.preset().id(),
                this.settings.effectiveRange(),
                this.settings.usingLearnedRange() ? "measured" : "configured",
                this.settings.comboBandDistance(),
                this.settings.dangerCloseDistance(), this.settings.minTapTicks(),
                this.settings.maxTapTicks(), this.settings.maxTradeDelayTicks()));
        reply(sender, "reach " + this.client.brain().reach().describe()
                + " | whiffs seen " + this.client.brain().reach().whiffs());
        reply(sender, "own ping " + lat.describeOwnLatency() + " (measured by server)"
                + ", opponent " + lat.describeOpponentLatency());
        reply(sender, "knockback " + kb.describe(true) + " sprint / " + kb.describe(false) + " walk"
                + " | server " + this.client.serverKey());
        reply(sender, String.format("confidence in use %.0f%% (needs %.0f%%) from %d samples",
                kb.overallConfidence() * 100.0D, this.settings.minConfidence() * 100.0D,
                kb.pooledSampleCount()));
        reply(sender, "hits confirmed " + this.client.hitObserver().confirmedHits()
                + ", unconfirmed " + this.client.hitObserver().unconfirmedAttacks()
                + ", attacks held " + this.client.gate().heldCount()
                + ", taps " + this.client.movement().actionsRun());
    }

    private void help(ICommandSender sender) {
        reply(sender, EnumChatFormatting.AQUA + "PCP commands");
        reply(sender, "/pcp preset <safe|balanced|aggressive> - set everything at once");
        reply(sender, "/pcp autoreach [on|off] - learn the attack range from your hits");
        reply(sender, "/pcp on|off - master switch");
        reply(sender, "/pcp wtap|stap|trade|spacing|overlay [on|off|toggle]");
        reply(sender, "/pcp reach <blocks> - manual range, used only if autoreach is off");
        reply(sender, "/pcp learn <0.05-1.0> - learning aggressiveness");
        reply(sender, "/pcp conf <0-0.95> - confidence needed for corrections");
        reply(sender, "/pcp taps <min> <max> - tap length bounds in ticks");
        reply(sender, "/pcp cooldown <ticks> | /pcp delay <ticks>");
        reply(sender, "/pcp reset - clear the learned knockback profile");
        reply(sender, "/pcp reload | /pcp gui | /pcp status");
    }

    private boolean flag(String[] args, boolean current) {
        if (args.length < 2) {
            return !current;
        }
        String v = args[1].toLowerCase();
        if ("on".equals(v) || "true".equals(v) || "1".equals(v)) {
            return true;
        }
        if ("off".equals(v) || "false".equals(v) || "0".equals(v)) {
            return false;
        }
        return !current;
    }

    private static double parseDoubleSafe(String raw, double fallback) {
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private void saveAndReply(ICommandSender sender, String message) {
        this.config.save();
        reply(sender, message);
    }

    private void reply(ICommandSender sender, String message) {
        sender.addChatMessage(new ChatComponentText(EnumChatFormatting.GRAY + message));
    }

    private static String state(boolean value) {
        return value ? (EnumChatFormatting.GREEN + "on" + EnumChatFormatting.GRAY)
                : (EnumChatFormatting.RED + "off" + EnumChatFormatting.GRAY);
    }
}
