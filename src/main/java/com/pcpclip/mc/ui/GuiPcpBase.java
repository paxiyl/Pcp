package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.mc.PcpClipMod;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared frame for the settings screens.
 *
 * <p>Sized for a phone held in one hand: buttons are taller than vanilla's and spaced further
 * apart, rows are full width on narrow screens and split into two columns only when there is
 * room, and nothing relies on hover, right-click or a scroll wheel. Values are changed by tapping
 * through choices or by stepping with plus and minus, so no text has to be typed on a touch
 * keyboard - paths, which really do need typing, are edited in {@code config/pcpclip.cfg}.
 */
public abstract class GuiPcpBase extends GuiScreen {

    protected static final int BUTTON_HEIGHT = 20;
    protected static final int ROW_SPACING = 22;
    protected static final int DONE_ID = 900;
    protected static final int BACK_ID = 901;

    protected static final int HEADING_COLOUR = 0xFFFFFF;
    protected static final int LABEL_COLOUR = 0xC0C0C0;
    protected static final int VALUE_COLOUR = 0xFFFFFF;
    protected static final int WARN_COLOUR = 0xFFC040;
    protected static final int GOOD_COLOUR = 0x80FF80;
    protected static final int BAD_COLOUR = 0xFF6060;

    private final GuiScreen parent;
    private final String title;

    /** Informational lines drawn under the controls; rebuilt whenever the layout is. */
    protected final List<String> footerLines = new ArrayList<String>();

    protected GuiPcpBase(GuiScreen parent, String title) {
        this.parent = parent;
        this.title = title;
    }

    protected ClipEngine engine() {
        return PcpClipMod.engine();
    }

    protected ClipConfig config() {
        return PcpClipMod.config();
    }

    /** Applies the edited settings to the running engine and writes the config file. */
    protected void saveSettings() {
        PcpClipMod mod = PcpClipMod.instance();
        if (mod != null) {
            mod.applyAndPersist(config());
        }
    }

    protected int contentWidth() {
        return Math.min(300, width - 20);
    }

    protected int contentLeft() {
        return (width - contentWidth()) / 2;
    }

    protected int firstRowY() {
        return Math.max(32, height / 6);
    }

    /** Adds a full-width control row and returns the y for the next one. */
    protected int addRow(int id, int y, String label) {
        buttonList.add(new GuiButton(id, contentLeft(), y, contentWidth(), BUTTON_HEIGHT, label));
        return y + ROW_SPACING;
    }

    /** Adds a label with a value control on the right, or stacks them on a narrow screen. */
    protected int addValueRow(int id, int y, String label, String value) {
        return addRow(id, y, label + ": " + value);
    }

    /**
     * Adds a stepper: a centred label with minus and plus buttons either side.
     *
     * @param minusId id reported when the value should go down; {@code minusId + 1} is the plus
     */
    protected int addStepper(int minusId, int y, String text) {
        int left = contentLeft();
        int total = contentWidth();
        int stepWidth = 28;
        buttonList.add(new GuiButton(minusId, left, y, stepWidth, BUTTON_HEIGHT, "-"));
        GuiButton middle = new GuiButton(minusId + 2, left + stepWidth + 2, y,
                total - 2 * stepWidth - 4, BUTTON_HEIGHT, text);
        middle.enabled = false;                        // a label, not a control
        buttonList.add(middle);
        buttonList.add(new GuiButton(minusId + 1, left + total - stepWidth, y, stepWidth,
                BUTTON_HEIGHT, "+"));
        return y + ROW_SPACING;
    }

    /** Adds two controls side by side, or stacks them when the screen is too narrow. */
    protected int addPair(int leftId, int rightId, int y, String leftLabel, String rightLabel) {
        int total = contentWidth();
        if (total < 200) {
            y = addRow(leftId, y, leftLabel);
            return addRow(rightId, y, rightLabel);
        }
        int half = (total - 4) / 2;
        int left = contentLeft();
        buttonList.add(new GuiButton(leftId, left, y, half, BUTTON_HEIGHT, leftLabel));
        buttonList.add(new GuiButton(rightId, left + half + 4, y, total - half - 4, BUTTON_HEIGHT,
                rightLabel));
        return y + ROW_SPACING;
    }

    protected void addDoneButton(int y, String label) {
        buttonList.add(new GuiButton(parent == null ? DONE_ID : BACK_ID, contentLeft(),
                Math.min(y, height - BUTTON_HEIGHT - 6), contentWidth(), BUTTON_HEIGHT, label));
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawDefaultBackground();
        drawCenteredString(fontRendererObj, title, width / 2, 12, HEADING_COLOUR);
        super.drawScreen(mouseX, mouseY, partialTicks);
        drawFooter();
    }

    /** Footer lines explain consequences: output size, cost, warnings. */
    private void drawFooter() {
        if (footerLines.isEmpty()) {
            return;
        }
        int y = height - 8 - footerLines.size() * 10;
        for (int i = 0; i < footerLines.size(); i++) {
            String line = footerLines.get(i);
            int colour = LABEL_COLOUR;
            if (line.startsWith("!")) {
                colour = WARN_COLOUR;
                line = line.substring(1);
            } else if (line.startsWith("+")) {
                colour = GOOD_COLOUR;
                line = line.substring(1);
            }
            drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(line, width - 16),
                    width / 2, y + i * 10, colour);
        }
    }

    @Override
    protected void actionPerformed(GuiButton button) {
        if (button.id == DONE_ID) {
            saveSettings();
            mc.displayGuiScreen(null);
            return;
        }
        if (button.id == BACK_ID) {
            saveSettings();
            mc.displayGuiScreen(parent);
            return;
        }
        onAction(button);
    }

    protected abstract void onAction(GuiButton button);

    /** Rebuilds the controls so labels show the new values. */
    protected void refresh() {
        buttonList.clear();
        footerLines.clear();
        initGui();
    }

    @Override
    public boolean doesGuiPauseGame() {
        // Single player must keep ticking: pausing the world would also pause the capture, and a
        // player checking their settings mid-game should not freeze the server they are on.
        return false;
    }

    protected static String onOff(boolean value) {
        return value ? "On" : "Off";
    }

    protected static int step(int value, int delta, int min, int max) {
        int stepped = value + delta;
        if (stepped < min) {
            return min;
        }
        return stepped > max ? max : stepped;
    }

    /** Steps through a fixed set of choices, wrapping at the end. */
    protected static int cycleIndex(int current, int size, int delta) {
        if (size <= 0) {
            return 0;
        }
        int next = (current + delta) % size;
        return next < 0 ? next + size : next;
    }
}
