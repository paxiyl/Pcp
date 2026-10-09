package dev.paxiyl.pcp.client;

import net.minecraft.client.settings.KeyBinding;
import net.minecraftforge.fml.client.registry.ClientRegistry;
import org.lwjgl.input.Keyboard;

/**
 * Key bindings, all rebindable through the vanilla Controls screen.
 *
 * <p>Only the four controls worth a default key get one; the rest start
 * unbound. That matters on PojavLauncher, where on-screen buttons are a scarce
 * resource - every one of these also has a {@code /pcp} subcommand, so the mod
 * is fully operable with no keys bound at all.</p>
 */
public final class KeyBindings {

    public static final String CATEGORY = "key.categories.pcp";

    public final KeyBinding toggleMaster = new KeyBinding("key.pcp.toggle", Keyboard.KEY_H, CATEGORY);
    public final KeyBinding toggleOverlay = new KeyBinding("key.pcp.overlay", Keyboard.KEY_J, CATEGORY);
    public final KeyBinding suspend = new KeyBinding("key.pcp.suspend", Keyboard.KEY_K, CATEGORY);
    public final KeyBinding openConfig = new KeyBinding("key.pcp.config", Keyboard.KEY_G, CATEGORY);
    public final KeyBinding toggleWTap = new KeyBinding("key.pcp.wtap", Keyboard.KEY_NONE, CATEGORY);
    public final KeyBinding toggleSTap = new KeyBinding("key.pcp.stap", Keyboard.KEY_NONE, CATEGORY);
    public final KeyBinding toggleTrade = new KeyBinding("key.pcp.trade", Keyboard.KEY_NONE, CATEGORY);
    /** Held, not toggled: while down, attacks pass straight through. */
    public final KeyBinding manualOverride = new KeyBinding("key.pcp.override", Keyboard.KEY_NONE, CATEGORY);

    public void register() {
        ClientRegistry.registerKeyBinding(this.toggleMaster);
        ClientRegistry.registerKeyBinding(this.toggleOverlay);
        ClientRegistry.registerKeyBinding(this.suspend);
        ClientRegistry.registerKeyBinding(this.openConfig);
        ClientRegistry.registerKeyBinding(this.toggleWTap);
        ClientRegistry.registerKeyBinding(this.toggleSTap);
        ClientRegistry.registerKeyBinding(this.toggleTrade);
        ClientRegistry.registerKeyBinding(this.manualOverride);
    }

    /**
     * True when a binding is actually bound. An unbound key has code 0, and
     * {@code isKeyDown()} on it must never be treated as pressed.
     */
    public static boolean bound(KeyBinding binding) {
        return binding != null && binding.getKeyCode() != Keyboard.KEY_NONE;
    }

    public static boolean heldSafely(KeyBinding binding) {
        return bound(binding) && binding.isKeyDown();
    }
}
