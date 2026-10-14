package net.minecraftforge.client;

import net.minecraft.command.CommandHandler;

/**
 * Compile-only stub; see stubs/java/README.md.
 *
 * <p>It extends {@link CommandHandler} deliberately: {@code registerCommand} is declared there,
 * on a Minecraft class, so the remapper needs to see the inheritance to rename the call site to
 * its runtime name. Forge's real class has the same parent.
 */
public class ClientCommandHandler extends CommandHandler {

    public static final ClientCommandHandler instance = new ClientCommandHandler();
}
