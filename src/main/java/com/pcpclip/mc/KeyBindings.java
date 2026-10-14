package com.pcpclip.mc;

import net.minecraft.client.settings.KeyBinding;
import net.minecraftforge.fml.client.registry.ClientRegistry;

import org.lwjgl.input.Keyboard;

/**
 * Hotkeys, registered with Minecraft so they appear in the normal Controls screen and can be
 * rebound there - including to on-screen buttons in PojavLauncher's control editor, which is how
 * most Android players will actually trigger them.
 *
 * <p>Defaults use F6 to F9 because vanilla 1.8.9 leaves those unbound.
 */
public final class KeyBindings {

    public static final String CATEGORY = "PcpClip";

    public static KeyBinding saveClip;
    public static KeyBinding quickSave;
    public static KeyBinding toggleRecording;
    public static KeyBinding openMenu;

    private KeyBindings() {
    }

    public static void register() {
        saveClip = new KeyBinding("Save instant replay clip", Keyboard.KEY_F6, CATEGORY);
        quickSave = new KeyBinding("Save clip again (same length)", Keyboard.KEY_F7, CATEGORY);
        toggleRecording = new KeyBinding("Start/stop recording", Keyboard.KEY_F8, CATEGORY);
        openMenu = new KeyBinding("Open PcpClip menu", Keyboard.KEY_F9, CATEGORY);

        ClientRegistry.registerKeyBinding(saveClip);
        ClientRegistry.registerKeyBinding(quickSave);
        ClientRegistry.registerKeyBinding(toggleRecording);
        ClientRegistry.registerKeyBinding(openMenu);
    }
}
