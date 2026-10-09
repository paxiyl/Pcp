package org.polyfrost.overflowanimations.command;

import net.minecraft.command.CommandBase;
import net.minecraft.command.ICommandSender;
import org.polyfrost.overflowanimations.config.OldAnimationsSettings;
import org.polyfrost.overflowanimations.util.Diagnostics;

import java.util.Arrays;
import java.util.List;

/**
 * Opens the settings screen. Registered with Forge's {@code ClientCommandHandler} now that
 * OneConfig's command framework is gone; the command and its aliases are unchanged.
 */
public class OldAnimationsCommand extends CommandBase {

    @Override
    public String getCommandName() {
        return "overflowanimations";
    }

    @Override
    public List<String> getCommandAliases() {
        return Arrays.asList("oam", "oldanimations", "animations");
    }

    @Override
    public String getCommandUsage(ICommandSender sender) {
        return "/overflowanimations [debug] - opens the settings, or prints a self-check";
    }

    @Override
    public boolean canCommandSenderUseCommand(ICommandSender sender) {
        // A client-side command; no permission level applies.
        return true;
    }

    @Override
    public void processCommand(ICommandSender sender, String[] args) {
        if (args.length > 0 && args[0].equalsIgnoreCase("debug")) {
            Diagnostics.report();
            return;
        }
        OldAnimationsSettings.INSTANCE.openGui();
    }
}
