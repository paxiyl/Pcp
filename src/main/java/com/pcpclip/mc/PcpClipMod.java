package com.pcpclip.mc;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.util.PcpLog;
import com.pcpclip.mc.ui.HudOverlay;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiScreen;
import net.minecraft.command.CommandHandler;
import net.minecraftforge.client.ClientCommandHandler;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.File;

/**
 * Mod entry point.
 *
 * <p>Client only: there is nothing to record on a server, and declaring it keeps the mod out of
 * the way of server-side mod checks.
 *
 * <p>Start-up does as little as possible. The engine is created but no thread is started and no
 * buffer allocated until the user actually turns recording on, so installing the mod and leaving
 * it alone costs a config file read.
 */
@Mod(modid = PcpClipMod.MODID,
        name = PcpClipMod.NAME,
        version = PcpClipMod.VERSION,
        clientSideOnly = true,
        acceptedMinecraftVersions = "[1.8.9]")
public class PcpClipMod {

    public static final String MODID = "pcpclip";
    public static final String NAME = "PcpClip";
    public static final String VERSION = "1.0.0";

    private static PcpClipMod instance;
    /**
     * A screen a chat command asked for. Opened on the next client tick rather than immediately:
     * a command runs while the chat screen is still closing, and swapping screens from inside
     * that leaves input in a strange state.
     */
    private static volatile GuiScreen requestedScreen;

    private final Logger logger = LogManager.getLogger(NAME);
    private File configFile;
    private ClipConfig config;
    private ClipEngine engine;
    private HudOverlay overlay;
    private ClientHooks hooks;

    public static PcpClipMod instance() {
        return instance;
    }

    public static ClipEngine engine() {
        return instance == null ? null : instance.engine;
    }

    public static ClipConfig config() {
        return instance == null ? null : instance.config;
    }

    public static HudOverlay overlay() {
        return instance == null ? null : instance.overlay;
    }

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        instance = this;
        PcpLog.setSink(new PcpLog.Sink() {
            @Override
            public void log(String level, String message, Throwable error) {
                if ("ERROR".equals(level)) {
                    logger.error(message, error);
                } else if ("WARN".equals(level)) {
                    if (error != null) {
                        logger.warn(message, error);
                    } else {
                        logger.warn(message);
                    }
                } else if ("DEBUG".equals(level)) {
                    logger.debug(message);
                } else {
                    logger.info(message);
                }
            }
        });

        configFile = new File(event.getModConfigurationDirectory(), MODID + ".cfg");
        config = ClipConfig.load(configFile);
        PcpLog.setDebug(config.debugLogging);
        if (!configFile.isFile()) {
            // Write the defaults out so the file is there to edit and to document the options.
            config.save(configFile);
        }

        File gameDirectory = Minecraft.getMinecraft().mcDataDir;
        overlay = new HudOverlay();
        engine = new ClipEngine(gameDirectory, config, overlay);
        engine.storage().removeStalePartials();

        PcpLog.info(NAME + " " + VERSION + " loaded; rolling buffer is "
                + (config.shadowBuffer ? "on" : "off") + ", clips go to "
                + engine.storage().clipDirectory());
    }

    /** Asks for a screen to be opened on the next client tick. */
    public static void requestScreen(GuiScreen screen) {
        requestedScreen = screen;
    }

    /** Takes the pending screen, if any. Called from the client tick. */
    static GuiScreen takeRequestedScreen() {
        GuiScreen screen = requestedScreen;
        requestedScreen = null;
        return screen;
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        KeyBindings.register();
        // A client-side command: it never reaches the server, so it works in single player, on
        // any server, and on servers that reject unknown commands.
        //
        // Deliberately called through CommandHandler rather than through ClientCommandHandler:
        // registerCommand is declared on Minecraft's class, so naming that class at the call site
        // is what lets the name be remapped to its runtime form. Going through the Forge subclass
        // would leave the readable name in the bytecode and fail at load with NoSuchMethodError.
        CommandHandler commands = ClientCommandHandler.instance;
        commands.registerCommand(new PcpClipCommand());
        hooks = new ClientHooks(engine, overlay);
        MinecraftForge.EVENT_BUS.register(hooks);
        Runtime.getRuntime().addShutdownHook(new Thread(new Runnable() {
            @Override
            public void run() {
                // Finish the segment being written so a clip can still be recovered next launch.
                ClipEngine running = engine;
                if (running != null) {
                    running.shutdown();
                }
            }
        }, "PcpClip-shutdown"));
    }

    /** Saves the config file after a settings change. */
    public void persistConfig() {
        if (config != null && configFile != null && !config.save(configFile)) {
            PcpLog.warn("Settings could not be written to " + configFile);
        }
    }

    /** Applies edited settings to the running engine and writes them out. */
    public void applyAndPersist(ClipConfig updated) {
        config = updated;
        if (engine != null) {
            engine.applyConfig(updated);
        }
        persistConfig();
    }
}
