package org.polyfrost.overflowanimations.util;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiScreen;

/**
 * Replaces OneConfig's {@code GuiUtils.displayScreen}. Screens are opened on the next client
 * tick so a command handler or a render callback never swaps the screen mid-frame.
 */
public class GuiQueue {

    private static GuiScreen pending;
    private static boolean closeRequested;

    private GuiQueue() {
    }

    /** Opens {@code screen} on the next client tick; {@code null} closes the current screen. */
    public static void open(GuiScreen screen) {
        if (screen == null) {
            closeRequested = true;
            pending = null;
        } else {
            pending = screen;
            closeRequested = false;
        }
    }

    public static void close() {
        open(null);
    }

    /** Called once per client tick from the mod's event handler. */
    public static void tick() {
        if (pending != null) {
            GuiScreen screen = pending;
            pending = null;
            Minecraft.getMinecraft().displayGuiScreen(screen);
        } else if (closeRequested) {
            closeRequested = false;
            Minecraft.getMinecraft().displayGuiScreen(null);
        }
    }
}
