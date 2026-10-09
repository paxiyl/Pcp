package org.polyfrost.overflowanimations.gui;

import net.minecraft.client.gui.GuiScreen;
import org.polyfrost.overflowanimations.OverflowAnimations;
import org.polyfrost.overflowanimations.config.OldAnimationsSettings;
import org.polyfrost.overflowanimations.hooks.AnimationExportUtils;

/**
 * Offers to import DulkirMod's item positions, as OneConfig's version of this screen did.
 * Redrawn with vanilla calls only so it works under PojavLauncher.
 */
public class PleaseMigrateDulkirModGui extends GuiScreen {

    private static final int PANEL = 0xFF16171A;
    private static final int OUTLINE = 0xFF34363C;
    private static final int ACCENT = 0xFF4C8BF5;
    private static final int DESTRUCTIVE = 0xFFB3413C;
    private static final int TEXT = 0xFFE8E8EA;
    private static final int TEXT_DIM = 0xFF9A9AA0;

    private static final int PANEL_WIDTH = 300;
    private static final int PANEL_HEIGHT = 124;
    private static final int BUTTON_WIDTH = 74;
    private static final int BUTTON_HEIGHT = 18;

    private boolean confirmingCancel;

    private int panelX;
    private int panelY;

    @Override
    public void initGui() {
        panelX = (width - PANEL_WIDTH) / 2;
        panelY = (height - PANEL_HEIGHT) / 2;
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawRect(0, 0, width, height, 0xE6101013);
        drawRect(panelX - 1, panelY - 1, panelX + PANEL_WIDTH + 1, panelY + PANEL_HEIGHT + 1, OUTLINE);
        drawRect(panelX, panelY, panelX + PANEL_WIDTH, panelY + PANEL_HEIGHT, PANEL);

        int centerX = panelX + PANEL_WIDTH / 2;
        drawCenteredString(fontRendererObj, "OverflowAnimations", centerX, panelY + 14, TEXT);
        drawCenteredString(fontRendererObj, "OverflowAnimations now replaces DulkirMod's", centerX, panelY + 38, TEXT_DIM);
        drawCenteredString(fontRendererObj, "animations feature.", centerX, panelY + 50, TEXT_DIM);
        drawCenteredString(fontRendererObj, "Would you like to import your DulkirMod config?", centerX, panelY + 66, TEXT_DIM);
        drawCenteredString(fontRendererObj, "(You can transfer it later in the settings)", centerX, panelY + 78, TEXT_DIM);

        drawButton(transferX(), buttonY(), "Transfer", ACCENT, mouseX, mouseY);
        drawButton(cancelX(), buttonY(), confirmingCancel ? "Confirm" : "Cancel", DESTRUCTIVE, mouseX, mouseY);

        super.drawScreen(mouseX, mouseY, partialTicks);
    }

    private void drawButton(int x, int y, String text, int color, int mouseX, int mouseY) {
        boolean hovered = isOver(mouseX, mouseY, x, y);
        drawRect(x, y, x + BUTTON_WIDTH, y + BUTTON_HEIGHT, hovered ? color : darken(color));
        drawCenteredString(fontRendererObj, text, x + BUTTON_WIDTH / 2, y + (BUTTON_HEIGHT - 8) / 2, TEXT);
    }

    private static int darken(int color) {
        int r = (color >> 16 & 0xFF) * 2 / 3;
        int g = (color >> 8 & 0xFF) * 2 / 3;
        int b = (color & 0xFF) * 2 / 3;
        return 0xFF000000 | r << 16 | g << 8 | b;
    }

    private int buttonY() {
        return panelY + PANEL_HEIGHT - 28;
    }

    private int transferX() {
        return panelX + PANEL_WIDTH / 2 - BUTTON_WIDTH - 5;
    }

    private int cancelX() {
        return panelX + PANEL_WIDTH / 2 + 5;
    }

    private static boolean isOver(int mouseX, int mouseY, int x, int y) {
        return mouseX >= x && mouseX < x + BUTTON_WIDTH && mouseY >= y && mouseY < y + BUTTON_HEIGHT;
    }

    @Override
    protected void mouseClicked(int mouseX, int mouseY, int mouseButton) throws java.io.IOException {
        super.mouseClicked(mouseX, mouseY, mouseButton);
        if (mouseButton != 0) return;
        if (isOver(mouseX, mouseY, transferX(), buttonY())) {
            markAsViewed();
            AnimationExportUtils.transferDulkirConfig();
            mc.displayGuiScreen(null);
        } else if (isOver(mouseX, mouseY, cancelX(), buttonY())) {
            if (confirmingCancel) {
                markAsViewed();
                mc.displayGuiScreen(null);
            } else {
                confirmingCancel = true;
            }
        }
    }

    @Override
    protected void keyTyped(char typedChar, int keyCode) throws java.io.IOException {
        // Dismissing with ESC counts as "not now", matching the Cancel button.
        if (keyCode == org.lwjgl.input.Keyboard.KEY_ESCAPE) {
            markAsViewed();
        }
        super.keyTyped(typedChar, keyCode);
    }

    @Override
    public boolean doesGuiPauseGame() {
        return false;
    }

    private void markAsViewed() {
        OverflowAnimations.doTheFunnyDulkirThing = false;
        OldAnimationsSettings.didTheFunnyDulkirThingElectricBoogaloo = true;
        OldAnimationsSettings.INSTANCE.save();
    }
}
