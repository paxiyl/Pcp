package dev.paxiyl.pcp;

import dev.paxiyl.pcp.client.KeyBindings;
import dev.paxiyl.pcp.client.PcpClient;
import dev.paxiyl.pcp.client.PcpCommand;
import dev.paxiyl.pcp.config.PcpConfig;
import dev.paxiyl.pcp.core.CoreSettings;
import net.minecraftforge.client.ClientCommandHandler;
import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.common.event.FMLInitializationEvent;
import net.minecraftforge.fml.common.event.FMLPreInitializationEvent;

/**
 * PCP - Precision Combat Pacing. Client-side adaptive PvP spacing and
 * trade-timing assistance for Minecraft 1.8.9 / Forge.
 *
 * <p>Structure: {@code core} holds the decision logic and knows nothing about
 * Minecraft, {@code client} adapts the game to it, {@code config} owns settings
 * and the settings screen.</p>
 *
 * <p>Nothing here touches packet construction, the game timer, or anything an
 * anti-cheat would see as evasion: the mod reads state the client already has
 * and acts through the same input and attack paths the player does.</p>
 */
@Mod(modid = PcpMod.MOD_ID,
     name = PcpMod.MOD_NAME,
     version = PcpMod.VERSION,
     clientSideOnly = true,
     acceptedMinecraftVersions = "[1.8.9]",
     guiFactory = "dev.paxiyl.pcp.config.PcpGuiFactory")
public class PcpMod {

    public static final String MOD_ID = "pcp";
    public static final String MOD_NAME = "PCP Adaptive Spacing";
    public static final String VERSION = "@MOD_VERSION@";

    @Mod.Instance(MOD_ID)
    public static PcpMod instance;

    private static PcpClient clientInstance;

    private CoreSettings settings;
    private PcpConfig config;
    private KeyBindings keys;

    /** Null until pre-init has run; the config screen tolerates that. */
    public static PcpClient client() {
        return clientInstance;
    }

    @Mod.EventHandler
    public void preInit(FMLPreInitializationEvent event) {
        this.settings = new CoreSettings();
        this.config = new PcpConfig(this.settings);
        this.config.load(event.getSuggestedConfigurationFile());

        this.keys = new KeyBindings();
        clientInstance = new PcpClient(this.config, this.keys, event.getModConfigurationDirectory());
    }

    @Mod.EventHandler
    public void init(FMLInitializationEvent event) {
        this.keys.register();

        // In 1.8.9 FMLCommonHandler's event bus is the same object as
        // MinecraftForge.EVENT_BUS (FMLCommonHandler assigns it directly), and
        // TickEvent/InputEvent are posted to it, so one registration covers the
        // tick, input, render, world and network events this mod listens for.
        MinecraftForge.EVENT_BUS.register(clientInstance);

        ClientCommandHandler.instance.registerCommand(new PcpCommand(clientInstance));
    }

    public PcpConfig config() {
        return this.config;
    }

    public KeyBindings keys() {
        return this.keys;
    }
}
