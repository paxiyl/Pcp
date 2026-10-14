package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.storage.ClipEntry;
import com.pcpclip.core.util.Fmt;

import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import org.lwjgl.input.Mouse;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * The saved clips, newest first.
 *
 * <p>Rows are tall enough to tap, scrolling works by button as well as by wheel, and each clip
 * shows what it actually is: length, size, dimensions and the frame rate that was really
 * captured - next to the rate that was asked for, when the two differ.
 */
public class GuiPcpClips extends GuiPcpBase {

    private static final int ID_UP = 10;
    private static final int ID_DOWN = 11;
    private static final int ID_DELETE = 20;
    private static final int ID_COPY_PATH = 21;

    private static final int ROW_HEIGHT = 24;
    private static final int LIST_TOP = 26;

    private List<ClipEntry> clips = new ArrayList<ClipEntry>();
    private int scroll;
    private int selected = -1;
    private String action = "";

    public GuiPcpClips(GuiScreen parent) {
        super(parent, "PcpClip - Saved clips");
    }

    @Override
    public void initGui() {
        ClipEngine engine = engine();
        clips = engine != null ? engine.library().list() : new ArrayList<ClipEntry>();
        if (selected >= clips.size()) {
            selected = clips.isEmpty() ? -1 : clips.size() - 1;
        }

        int controlsY = height - 2 * ROW_SPACING - 4;
        addPair(ID_UP, ID_DOWN, controlsY, "Up", "Down");
        int y = controlsY + ROW_SPACING;
        boolean hasSelection = selected >= 0 && selected < clips.size();
        int left = contentLeft();
        int total = contentWidth();
        int third = (total - 8) / 3;
        GuiButton delete = new GuiButton(ID_DELETE, left, y, third, BUTTON_HEIGHT, "Delete");
        delete.enabled = hasSelection;
        buttonList.add(delete);
        GuiButton copy = new GuiButton(ID_COPY_PATH, left + third + 4, y, third, BUTTON_HEIGHT,
                "Copy path");
        copy.enabled = hasSelection;
        buttonList.add(copy);
        buttonList.add(new GuiButton(BACK_ID, left + 2 * third + 8, y, total - 2 * third - 8,
                BUTTON_HEIGHT, "Back"));

        if (!action.isEmpty()) {
            footerLines.add("+" + action);
        }
    }

    private int visibleRows() {
        int available = height - LIST_TOP - 2 * ROW_SPACING - 16;
        return Math.max(1, available / ROW_HEIGHT);
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawDefaultBackground();
        drawCenteredString(fontRendererObj, "PcpClip - Saved clips (" + clips.size() + ")",
                width / 2, 10, HEADING_COLOUR);

        if (clips.isEmpty()) {
            drawCenteredString(fontRendererObj, "No clips yet.", width / 2, LIST_TOP + 20,
                    LABEL_COLOUR);
            drawCenteredString(fontRendererObj,
                    "Turn on the instant replay buffer, then press F6.", width / 2,
                    LIST_TOP + 34, LABEL_COLOUR);
        } else {
            int rows = visibleRows();
            int left = contentLeft();
            int rowWidth = contentWidth();
            for (int i = 0; i < rows; i++) {
                int index = scroll + i;
                if (index >= clips.size()) {
                    break;
                }
                ClipEntry entry = clips.get(index);
                int y = LIST_TOP + i * ROW_HEIGHT;
                boolean isSelected = index == selected;
                Gui.drawRect(left, y, left + rowWidth, y + ROW_HEIGHT - 2,
                        isSelected ? 0xB03060A0 : 0x60000000);
                String name = fontRendererObj.trimStringToWidth(entry.name(), rowWidth - 8);
                fontRendererObj.drawStringWithShadow(name, left + 4, y + 3,
                        isSelected ? 0xFFFFFF : 0xD0D0D0);
                String detail = fontRendererObj.trimStringToWidth(entry.summary(), rowWidth - 8);
                fontRendererObj.drawStringWithShadow(detail, left + 4, y + 13, 0x90B0C0);
            }
            if (clips.size() > rows) {
                drawCenteredString(fontRendererObj,
                        (scroll + 1) + "-" + Math.min(clips.size(), scroll + rows) + " of "
                                + clips.size(), width / 2, LIST_TOP + rows * ROW_HEIGHT + 2,
                        LABEL_COLOUR);
            }
        }

        super.drawScreen(mouseX, mouseY, partialTicks);
        drawSelectionDetail();
    }

    private void drawSelectionDetail() {
        if (selected < 0 || selected >= clips.size()) {
            return;
        }
        ClipEntry entry = clips.get(selected);
        String stamp = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)
                .format(new Date(entry.savedAtMillis));
        StringBuilder detail = new StringBuilder();
        detail.append(stamp).append("  ").append(entry.codec.toUpperCase(Locale.ROOT));
        if (entry.frames > 0) {
            detail.append("  ").append(entry.frames).append(" frames");
        }
        if (entry.targetFps > 0 && entry.measuredFps > 0.0
                && entry.measuredFps < entry.targetFps * 0.9) {
            detail.append(String.format(Locale.ROOT, "  (%.0f fps captured, %d requested)",
                    entry.measuredFps, entry.targetFps));
        }
        int y = height - 3 * ROW_SPACING - 6;
        drawCenteredString(fontRendererObj,
                fontRendererObj.trimStringToWidth(detail.toString(), width - 10), width / 2, y,
                LABEL_COLOUR);
        if (!entry.note.isEmpty()) {
            drawCenteredString(fontRendererObj,
                    fontRendererObj.trimStringToWidth(entry.note, width - 10), width / 2, y - 10,
                    WARN_COLOUR);
        }
    }

    @Override
    protected void mouseClicked(int mouseX, int mouseY, int mouseButton) {
        super.mouseClicked(mouseX, mouseY, mouseButton);
        if (mouseButton != 0 || clips.isEmpty()) {
            return;
        }
        int left = contentLeft();
        if (mouseX < left || mouseX > left + contentWidth()) {
            return;
        }
        int rows = visibleRows();
        for (int i = 0; i < rows; i++) {
            int index = scroll + i;
            if (index >= clips.size()) {
                break;
            }
            int y = LIST_TOP + i * ROW_HEIGHT;
            if (mouseY >= y && mouseY < y + ROW_HEIGHT - 2) {
                selected = index;
                action = "";
                refresh();
                return;
            }
        }
    }

    @Override
    public void handleMouseInput() {
        super.handleMouseInput();
        int wheel = Mouse.getEventDWheel();
        if (wheel != 0 && !clips.isEmpty()) {
            scrollBy(wheel > 0 ? -1 : 1);
        }
    }

    private void scrollBy(int delta) {
        int maximum = Math.max(0, clips.size() - visibleRows());
        scroll = Math.max(0, Math.min(maximum, scroll + delta));
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipEngine engine = engine();
        switch (button.id) {
            case ID_UP:
                scrollBy(-1);
                break;
            case ID_DOWN:
                scrollBy(1);
                break;
            case ID_DELETE:
                if (engine != null && selected >= 0 && selected < clips.size()) {
                    ClipEntry entry = clips.get(selected);
                    action = engine.library().delete(entry)
                            ? "Deleted " + entry.name()
                            : "Could not delete " + entry.name();
                    selected = -1;
                }
                break;
            case ID_COPY_PATH:
                if (selected >= 0 && selected < clips.size()) {
                    ClipEntry entry = clips.get(selected);
                    setClipboardString(entry.file.getAbsolutePath());
                    action = "Path copied: " + entry.name() + " (" + Fmt.bytes(entry.sizeBytes) + ")";
                }
                break;
            default:
                break;
        }
        refresh();
    }
}
