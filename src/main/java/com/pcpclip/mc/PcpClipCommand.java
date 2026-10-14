package com.pcpclip.mc;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.storage.ClipEntry;
import com.pcpclip.core.util.Fmt;
import com.pcpclip.mc.ui.GuiPcpClips;
import com.pcpclip.mc.ui.GuiPcpMain;

import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import net.minecraft.util.BlockPos;
import net.minecraft.util.ChatComponentText;
import net.minecraft.util.EnumChatFormatting;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Chat commands, as an alternative to the hotkeys.
 *
 * <p>On a touchscreen a chat command is often easier than finding somewhere to put an F-key, so
 * everything the hotkeys do is reachable as {@code /pcpclip ...} too.
 *
 * <p>Registered through Forge's client command handler, so it never reaches the server: it works
 * in single player, on any multiplayer server, and on servers that block unknown commands. The
 * command name is deliberately specific - a short name like {@code /clip} would shadow a server's
 * own command of that name, since the client handler gets first refusal.
 *
 * <p>Opening a screen is deferred by a tick rather than done here: this runs while the chat screen
 * is still closing, and replacing a screen from inside that is how mods end up with a black
 * screen or swallowed input.
 */
public class PcpClipCommand extends CommandBase {

    private static final String[] SUBCOMMANDS = {
            "clip", "save", "record", "stop", "pause", "resume", "buffer", "status", "clips",
            "settings", "help",
    };

    @Override
    public String getCommandName() {
        return "pcpclip";
    }

    @Override
    public List<String> getCommandAliases() {
        List<String> aliases = new ArrayList<String>();
        aliases.add("pcp");
        return aliases;
    }

    @Override
    public String getCommandUsage(ICommandSender sender) {
        return "/pcpclip [clip <seconds> | record | stop | pause | resume | buffer on|off "
                + "| status | clips | settings]";
    }

    @Override
    public boolean canCommandSenderUseCommand(ICommandSender sender) {
        // A client command changes nothing on the server, so no permission level applies.
        return true;
    }

    @Override
    public List<String> addTabCompletionOptions(ICommandSender sender, String[] args, BlockPos pos) {
        if (args.length == 1) {
            return getListOfStringsMatchingLastWord(args, SUBCOMMANDS);
        }
        if (args.length == 2 && ("clip".equalsIgnoreCase(args[0]) || "save".equalsIgnoreCase(args[0]))) {
            return getListOfStringsMatchingLastWord(args, "15", "30", "60", "120");
        }
        if (args.length == 2 && "buffer".equalsIgnoreCase(args[0])) {
            return getListOfStringsMatchingLastWord(args, "on", "off");
        }
        return new ArrayList<String>();
    }

    @Override
    public void processCommand(ICommandSender sender, String[] args) {
        ClipEngine engine = PcpClipMod.engine();
        ClipConfig config = PcpClipMod.config();
        if (engine == null || config == null) {
            reply(sender, EnumChatFormatting.RED, "PcpClip is not initialised yet.");
            return;
        }

        String action = args.length == 0 ? "settings" : args[0].toLowerCase(Locale.ROOT);

        if ("settings".equals(action) || "gui".equals(action) || "menu".equals(action)) {
            PcpClipMod.requestScreen(new GuiPcpMain(null));
            return;
        }
        if ("clips".equals(action) || "history".equals(action) || "list".equals(action)) {
            if (args.length > 1 && "chat".equalsIgnoreCase(args[1])) {
                listClipsInChat(sender, engine);
            } else {
                PcpClipMod.requestScreen(new GuiPcpClips(null));
            }
            return;
        }
        if ("clip".equals(action) || "save".equals(action)) {
            int seconds = config.clipSeconds;
            if (args.length > 1) {
                try {
                    seconds = Integer.parseInt(args[1].trim());
                } catch (NumberFormatException notANumber) {
                    reply(sender, EnumChatFormatting.RED,
                            "'" + args[1] + "' is not a number of seconds.");
                    return;
                }
                if (seconds < ClipConfig.MIN_BUFFER_SECONDS || seconds > config.shadowBufferSeconds) {
                    reply(sender, EnumChatFormatting.RED, "Ask for between "
                            + ClipConfig.MIN_BUFFER_SECONDS + " and " + config.shadowBufferSeconds
                            + " seconds - that is how much the buffer is keeping.");
                    return;
                }
            }
            // The engine reports the outcome itself, through the usual on-screen message.
            engine.saveRollingClip(seconds);
            return;
        }
        if ("record".equals(action) || "rec".equals(action)) {
            if (engine.status().recording()) {
                reply(sender, EnumChatFormatting.YELLOW,
                        "Already recording - /pcpclip stop finishes it.");
            } else {
                engine.startRecording();
            }
            return;
        }
        if ("stop".equals(action)) {
            if (engine.status().recording()) {
                engine.stopRecording();
            } else {
                reply(sender, EnumChatFormatting.YELLOW, "Not recording.");
            }
            return;
        }
        if ("pause".equals(action)) {
            if (engine.mode() == ClipEngine.Mode.RECORDING) {
                engine.pauseRecording();
            } else {
                reply(sender, EnumChatFormatting.YELLOW, "Not recording.");
            }
            return;
        }
        if ("resume".equals(action)) {
            if (engine.mode() == ClipEngine.Mode.PAUSED) {
                engine.resumeRecording();
            } else {
                reply(sender, EnumChatFormatting.YELLOW, "Not paused.");
            }
            return;
        }
        if ("buffer".equals(action)) {
            if (args.length < 2) {
                reply(sender, EnumChatFormatting.YELLOW, "Instant replay buffer is "
                        + (config.shadowBuffer ? "on" : "off") + ". Use /pcpclip buffer on|off.");
                return;
            }
            String value = args[1].toLowerCase(Locale.ROOT);
            boolean wanted;
            if ("on".equals(value) || "true".equals(value) || "1".equals(value)) {
                wanted = true;
            } else if ("off".equals(value) || "false".equals(value) || "0".equals(value)) {
                wanted = false;
            } else {
                reply(sender, EnumChatFormatting.RED, "Use 'on' or 'off'.");
                return;
            }
            config.shadowBuffer = wanted;
            PcpClipMod mod = PcpClipMod.instance();
            if (mod != null) {
                mod.applyAndPersist(config);
            }
            reply(sender, EnumChatFormatting.GREEN, "Instant replay buffer "
                    + (wanted ? "on - it starts filling now." : "off - no per-frame work at all."));
            return;
        }
        if ("status".equals(action)) {
            reportStatus(sender, engine);
            return;
        }
        if ("help".equals(action) || "?".equals(action)) {
            help(sender);
            return;
        }
        reply(sender, EnumChatFormatting.RED, "Unknown option '" + action + "'.");
        help(sender);
    }

    private void reportStatus(ICommandSender sender, ClipEngine engine) {
        ClipEngine.Status status = engine.status();
        reply(sender, EnumChatFormatting.AQUA, "PcpClip: " + status.mode.label()
                + "  " + status.outputWidth + "x" + status.outputHeight
                + "  target " + status.targetFps + " fps");
        if (status.mode == ClipEngine.Mode.IDLE) {
            reply(sender, EnumChatFormatting.GRAY, "Encoder: " + status.backend
                    + "   storage: " + status.freeSpace);
            reply(sender, EnumChatFormatting.GRAY,
                    "Buffer is off. /pcpclip buffer on starts instant replay.");
            return;
        }
        reply(sender, EnumChatFormatting.GRAY, String.format(Locale.ROOT,
                "Captured %.1f fps, %.1f%% dropped, queue %d, buffer %.0f/%ds (%s)",
                status.measuredFps, status.dropPercent, status.backlog, status.bufferedSeconds,
                status.bufferSeconds, Fmt.bytes(status.bufferBytes)));
        reply(sender, EnumChatFormatting.GRAY, String.format(Locale.ROOT,
                "Readback %.2f ms/frame, encode %.0f ms/frame, %s",
                status.readbackMillis, status.encodeMillis, status.backend));
        if (status.performanceLevel > 0) {
            reply(sender, EnumChatFormatting.YELLOW, "Performance saver at level "
                    + status.performanceLevel + ": " + status.performanceReason);
        }
        if (status.dropPercent > 5.0) {
            reply(sender, EnumChatFormatting.YELLOW,
                    "Dropping frames - lower the resolution or frame rate in /pcpclip settings.");
        }
    }

    private void listClipsInChat(ICommandSender sender, ClipEngine engine) {
        List<ClipEntry> clips = engine.library().list();
        if (clips.isEmpty()) {
            reply(sender, EnumChatFormatting.GRAY, "No clips saved yet.");
            return;
        }
        reply(sender, EnumChatFormatting.AQUA, clips.size() + " clip(s), newest first:");
        int shown = Math.min(5, clips.size());
        for (int i = 0; i < shown; i++) {
            ClipEntry entry = clips.get(i);
            reply(sender, EnumChatFormatting.GRAY, "  " + entry.name() + "  -  " + entry.summary());
        }
        if (clips.size() > shown) {
            reply(sender, EnumChatFormatting.GRAY,
                    "  ...and " + (clips.size() - shown) + " more; /pcpclip clips opens the list.");
        }
    }

    private void help(ICommandSender sender) {
        reply(sender, EnumChatFormatting.AQUA, "PcpClip commands (/pcp works too):");
        String[][] lines = {
                {"/pcpclip", "open the settings screen"},
                {"/pcpclip clip [seconds]", "save the last N seconds (default: your clip length)"},
                {"/pcpclip record", "start a manual recording"},
                {"/pcpclip stop", "finish it and save"},
                {"/pcpclip pause | resume", "pause or resume a recording"},
                {"/pcpclip buffer on|off", "turn instant replay on or off"},
                {"/pcpclip status", "what is happening right now"},
                {"/pcpclip clips [chat]", "the saved clips, as a screen or in chat"},
        };
        for (String[] line : lines) {
            reply(sender, EnumChatFormatting.GRAY, "  " + line[0] + "  -  " + line[1]);
        }
        reply(sender, EnumChatFormatting.GRAY,
                "  Hotkeys F6 save, F7 save again, F8 record, F9 menu (rebindable in Controls)");
    }

    private static void reply(ICommandSender sender, EnumChatFormatting colour, String message) {
        sender.addChatMessage(new ChatComponentText(colour + message));
    }

    /** Client commands sort before server ones; ordering among them does not matter. */
    @Override
    public boolean isUsernameIndex(String[] args, int index) {
        return false;
    }
}
