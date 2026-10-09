package org.polyfrost.overflowanimations.gui;

import net.minecraft.client.gui.GuiScreen;
import net.minecraft.client.renderer.GlStateManager;
import org.lwjgl.input.Keyboard;
import org.lwjgl.input.Mouse;
import org.polyfrost.overflowanimations.config.ConfigBase;
import org.polyfrost.overflowanimations.config.ConfigOption;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The settings screen, drawn with nothing but {@code drawRect} and the vanilla font renderer.
 *
 * <p>OneConfig's GUI drew through NanoVG and its own LWJGL bindings, which is the part that
 * fails under PojavLauncher's GL4ES. Everything here goes through calls the game itself makes
 * every frame, so it renders on any platform Minecraft 1.8.9 runs on.
 */
public class OverflowSettingsGui extends GuiScreen {

    private static final int BACKGROUND = 0xE6101013;
    private static final int PANEL = 0xFF1A1B1F;
    private static final int PANEL_LIGHT = 0xFF24262B;
    private static final int OUTLINE = 0xFF34363C;
    private static final int ACCENT = 0xFF4C8BF5;
    private static final int ACCENT_DIM = 0xFF2E4F80;
    private static final int TEXT = 0xFFE8E8EA;
    private static final int TEXT_DIM = 0xFF8A8A90;
    private static final int TEXT_DISABLED = 0xFF5A5A60;
    private static final int TOGGLE_OFF = 0xFF44464C;

    private static final int ROW_HEIGHT = 22;
    private static final int HEADER_HEIGHT = 20;
    private static final int TAB_HEIGHT = 16;
    private static final int TOGGLE_WIDTH = 26;
    private static final int DROPDOWN_WIDTH = 124;
    private static final int SLIDER_WIDTH = 104;
    private static final int BUTTON_WIDTH = 62;
    private static final int CONTROL_HEIGHT = 14;
    private static final int SCROLLBAR_WIDTH = 4;

    private final ConfigBase config;

    private String activeCategory;
    private final List<Row> rows = new ArrayList<>();
    private final List<Tab> tabs = new ArrayList<>();

    private int contentTop;
    private int contentBottom;
    private int contentHeight;
    private int scroll;

    private ConfigOption draggingSlider;
    private boolean draggingScrollbar;
    private boolean draggingContent;
    private int dragAnchorY;
    private int dragAnchorScroll;

    public OverflowSettingsGui(ConfigBase config) {
        this.config = config;
        List<String> categories = config.getCategories();
        this.activeCategory = categories.isEmpty() ? "General" : categories.get(0);
    }

    // ----------------------------------------------------------------- layout

    @Override
    public void initGui() {
        Keyboard.enableRepeatEvents(true);
        layoutTabs();
        buildRows();
    }

    private void layoutTabs() {
        tabs.clear();
        int x = 6;
        int y = HEADER_HEIGHT + 2;
        for (String category : config.getCategories()) {
            int tabWidth = fontRendererObj.getStringWidth(category) + 12;
            if (x + tabWidth > width - 6 && x > 6) {
                x = 6;
                y += TAB_HEIGHT + 2;
            }
            tabs.add(new Tab(category, x, y, tabWidth));
            x += tabWidth + 2;
        }
        int tabsBottom = tabs.isEmpty() ? HEADER_HEIGHT : y + TAB_HEIGHT;
        contentTop = tabsBottom + 5;
        contentBottom = height - 24;
    }

    private void buildRows() {
        rows.clear();
        // Grouped rather than run-length encoded, so a JVM that hands back fields in some
        // other order can't produce a repeated subcategory heading.
        Map<String, List<ConfigOption>> grouped = new LinkedHashMap<>();
        for (ConfigOption option : config.getOptions()) {
            if (!option.category.equals(activeCategory)) continue;
            grouped.computeIfAbsent(option.subcategory, k -> new ArrayList<>()).add(option);
        }
        int y = 0;
        for (Map.Entry<String, List<ConfigOption>> entry : grouped.entrySet()) {
            rows.add(Row.header(entry.getKey(), y));
            y += HEADER_HEIGHT;
            for (ConfigOption option : entry.getValue()) {
                rows.add(Row.option(option, y));
                y += ROW_HEIGHT;
            }
        }
        contentHeight = y + 4;
        clampScroll();
    }

    private void clampScroll() {
        int max = Math.max(0, contentHeight - (contentBottom - contentTop));
        if (scroll > max) scroll = max;
        if (scroll < 0) scroll = 0;
    }

    private int controlLeft(ConfigOption option) {
        return width - 10 - SCROLLBAR_WIDTH - controlWidth(option);
    }

    private static int controlWidth(ConfigOption option) {
        switch (option.type) {
            case DROPDOWN:
                return DROPDOWN_WIDTH;
            case SLIDER:
                return SLIDER_WIDTH;
            case BUTTON:
                return BUTTON_WIDTH;
            default:
                return TOGGLE_WIDTH;
        }
    }

    // ---------------------------------------------------------------- drawing

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        drawRect(0, 0, width, height, BACKGROUND);

        // Header.
        drawRect(0, 0, width, HEADER_HEIGHT, PANEL);
        fontRendererObj.drawString(config.getDisplayName() + " Settings", 6, (HEADER_HEIGHT - 8) / 2, TEXT);
        String hint = "ESC or Done to close";
        fontRendererObj.drawString(hint, width - 6 - fontRendererObj.getStringWidth(hint), (HEADER_HEIGHT - 8) / 2, TEXT_DIM);

        // Category tabs.
        for (Tab tab : tabs) {
            boolean active = tab.category.equals(activeCategory);
            drawRect(tab.x, tab.y, tab.x + tab.width, tab.y + TAB_HEIGHT, active ? ACCENT : PANEL_LIGHT);
            drawCenteredString(fontRendererObj, tab.category, tab.x + tab.width / 2, tab.y + (TAB_HEIGHT - 8) / 2, active ? 0xFFFFFFFF : TEXT_DIM);
        }

        // Content panel.
        drawRect(4, contentTop - 2, width - 4, contentBottom + 2, PANEL);
        drawRect(4, contentTop - 2, width - 4, contentTop - 1, OUTLINE);
        drawRect(4, contentBottom + 1, width - 4, contentBottom + 2, OUTLINE);

        ConfigOption hovered = null;
        for (Row row : rows) {
            int y = contentTop + row.y - scroll;
            if (y + row.height() < contentTop || y > contentBottom) continue;
            if (row.isHeader()) {
                drawHeaderRow(row, y);
            } else {
                boolean rowHovered = mouseY >= y && mouseY < y + ROW_HEIGHT && mouseY >= contentTop && mouseY <= contentBottom
                        && mouseX >= 4 && mouseX <= width - 4;
                drawOptionRow(row.option, y, mouseX, mouseY, rowHovered);
                if (rowHovered) hovered = row.option;
            }
        }

        drawScrollbar();

        // Footer.
        drawRect(0, height - 22, width, height, PANEL);
        String footer = "Reopen with /oam  |  Scroll with the mouse wheel, the bar on the right, or by dragging";
        fontRendererObj.drawString(trim(footer, width - 90), 6, height - 15, TEXT_DIM);
        drawButtonBox(width - 74, height - 18, 68, 14, "Done", isOver(mouseX, mouseY, width - 74, height - 18, 68, 14), true);

        if (hovered != null && hovered.description != null && !hovered.description.isEmpty()) {
            List<String> lines = new ArrayList<>(fontRendererObj.listFormattedStringToWidth(hovered.description, Math.min(260, width - 40)));
            lines.add(0, hovered.name);
            drawHoveringText(lines, mouseX, Math.max(mouseY, 20));
            GlStateManager.disableLighting();
        }

        super.drawScreen(mouseX, mouseY, partialTicks);
    }

    private void drawHeaderRow(Row row, int y) {
        int textY = y + HEADER_HEIGHT - 11;
        fontRendererObj.drawString(row.header.toUpperCase(), 8, textY, ACCENT);
        int lineY = textY + 10;
        drawRect(8, lineY, width - 10 - SCROLLBAR_WIDTH, lineY + 1, OUTLINE);
    }

    private void drawOptionRow(ConfigOption option, int y, int mouseX, int mouseY, boolean rowHovered) {
        boolean usable = config.isOptionEnabled(option.fieldName());
        if (rowHovered && usable) {
            drawRect(5, y, width - 5, y + ROW_HEIGHT - 1, PANEL_LIGHT);
        }

        int controlX = controlLeft(option);
        int controlY = y + (ROW_HEIGHT - CONTROL_HEIGHT) / 2;
        int nameColor = usable ? TEXT : TEXT_DISABLED;

        int nameSpace = controlX - 8 - 6;
        if (option.type == ConfigOption.Type.SLIDER) {
            nameSpace -= 34;
        }
        fontRendererObj.drawString(trim(option.name, Math.max(10, nameSpace)), 8, y + (ROW_HEIGHT - 8) / 2 - 1, nameColor);

        switch (option.type) {
            case TOGGLE:
                drawToggle(controlX, controlY, option.getBoolean(), usable);
                break;
            case DROPDOWN:
                drawDropdown(option, controlX, controlY, mouseX, mouseY, usable);
                break;
            case SLIDER:
                drawSlider(option, controlX, controlY, usable);
                break;
            case BUTTON:
                drawButtonBox(controlX, controlY, BUTTON_WIDTH, CONTROL_HEIGHT, option.buttonText,
                        usable && isOver(mouseX, mouseY, controlX, controlY, BUTTON_WIDTH, CONTROL_HEIGHT), usable);
                break;
        }
    }

    private void drawToggle(int x, int y, boolean on, boolean usable) {
        int track = on ? (usable ? ACCENT : ACCENT_DIM) : TOGGLE_OFF;
        drawRect(x, y + 1, x + TOGGLE_WIDTH, y + CONTROL_HEIGHT - 1, track);
        int knobX = on ? x + TOGGLE_WIDTH - 11 : x + 2;
        drawRect(knobX, y + 3, knobX + 9, y + CONTROL_HEIGHT - 3, usable ? 0xFFFFFFFF : 0xFF9A9AA0);
    }

    private void drawDropdown(ConfigOption option, int x, int y, int mouseX, int mouseY, boolean usable) {
        drawRect(x, y, x + DROPDOWN_WIDTH, y + CONTROL_HEIGHT, PANEL_LIGHT);
        drawRect(x, y, x + 14, y + CONTROL_HEIGHT, isOver(mouseX, mouseY, x, y, 14, CONTROL_HEIGHT) && usable ? ACCENT : OUTLINE);
        drawRect(x + DROPDOWN_WIDTH - 14, y, x + DROPDOWN_WIDTH, y + CONTROL_HEIGHT,
                isOver(mouseX, mouseY, x + DROPDOWN_WIDTH - 14, y, 14, CONTROL_HEIGHT) && usable ? ACCENT : OUTLINE);
        int color = usable ? TEXT : TEXT_DISABLED;
        drawCenteredString(fontRendererObj, "<", x + 7, y + 3, color);
        drawCenteredString(fontRendererObj, ">", x + DROPDOWN_WIDTH - 7, y + 3, color);
        int index = option.getInt();
        String value = index >= 0 && index < option.options.length ? option.options[index] : String.valueOf(index);
        drawCenteredString(fontRendererObj, trim(value, DROPDOWN_WIDTH - 32), x + DROPDOWN_WIDTH / 2, y + 3, color);
    }

    private void drawSlider(ConfigOption option, int x, int y, boolean usable) {
        float value = option.getFloat();
        float fraction = option.max == option.min ? 0f : (value - option.min) / (option.max - option.min);
        fraction = Math.max(0f, Math.min(1f, fraction));
        int trackY = y + CONTROL_HEIGHT / 2 - 1;
        drawRect(x, trackY, x + SLIDER_WIDTH, trackY + 2, TOGGLE_OFF);
        int knobX = x + (int) (fraction * SLIDER_WIDTH);
        drawRect(x, trackY, knobX, trackY + 2, usable ? ACCENT : ACCENT_DIM);
        drawRect(knobX - 2, y + 1, knobX + 2, y + CONTROL_HEIGHT - 1, usable ? 0xFFFFFFFF : 0xFF9A9AA0);
        String text = format(value, option.step);
        fontRendererObj.drawString(text, x - 6 - fontRendererObj.getStringWidth(text), y + 3, usable ? TEXT_DIM : TEXT_DISABLED);
    }

    private void drawButtonBox(int x, int y, int w, int h, String text, boolean hovered, boolean usable) {
        drawRect(x, y, x + w, y + h, hovered ? ACCENT : PANEL_LIGHT);
        drawRect(x, y, x + w, y + 1, OUTLINE);
        drawCenteredString(fontRendererObj, trim(text, w - 6), x + w / 2, y + (h - 8) / 2, usable ? TEXT : TEXT_DISABLED);
    }

    private void drawScrollbar() {
        int viewport = contentBottom - contentTop;
        if (contentHeight <= viewport) return;
        int x = width - 6 - SCROLLBAR_WIDTH;
        drawRect(x, contentTop, x + SCROLLBAR_WIDTH, contentBottom, 0xFF17181B);
        int thumbHeight = Math.max(16, viewport * viewport / contentHeight);
        int travel = viewport - thumbHeight;
        int max = contentHeight - viewport;
        int thumbY = contentTop + (max == 0 ? 0 : scroll * travel / max);
        drawRect(x, thumbY, x + SCROLLBAR_WIDTH, thumbY + thumbHeight, ACCENT);
    }

    // ----------------------------------------------------------------- input

    @Override
    protected void mouseClicked(int mouseX, int mouseY, int mouseButton) throws java.io.IOException {
        super.mouseClicked(mouseX, mouseY, mouseButton);
        if (mouseButton != 0 && mouseButton != 1) return;

        if (mouseButton == 0) {
            if (isOver(mouseX, mouseY, width - 74, height - 18, 68, 14)) {
                mc.displayGuiScreen(null);
                return;
            }
            for (Tab tab : tabs) {
                if (isOver(mouseX, mouseY, tab.x, tab.y, tab.width, TAB_HEIGHT)) {
                    if (!tab.category.equals(activeCategory)) {
                        activeCategory = tab.category;
                        scroll = 0;
                        buildRows();
                    }
                    return;
                }
            }
            int scrollbarX = width - 6 - SCROLLBAR_WIDTH;
            if (mouseX >= scrollbarX && mouseX <= scrollbarX + SCROLLBAR_WIDTH && mouseY >= contentTop && mouseY <= contentBottom) {
                draggingScrollbar = true;
                scrollTo(mouseY);
                return;
            }
        }

        if (mouseY < contentTop || mouseY > contentBottom) return;

        for (Row row : rows) {
            if (row.isHeader()) continue;
            int y = contentTop + row.y - scroll;
            if (mouseY < y || mouseY >= y + ROW_HEIGHT) continue;
            ConfigOption option = row.option;
            if (!config.isOptionEnabled(option.fieldName())) return;

            int controlX = controlLeft(option);
            int controlY = y + (ROW_HEIGHT - CONTROL_HEIGHT) / 2;
            int controlW = controlWidth(option);

            switch (option.type) {
                case TOGGLE:
                    if (mouseButton == 0 && isOver(mouseX, mouseY, controlX, controlY, controlW, CONTROL_HEIGHT)) {
                        option.setBoolean(!option.getBoolean());
                        changed(option);
                        return;
                    }
                    break;
                case DROPDOWN:
                    if (isOver(mouseX, mouseY, controlX, controlY, controlW, CONTROL_HEIGHT)) {
                        boolean back = mouseButton == 1 || mouseX < controlX + 14;
                        cycle(option, back ? -1 : 1);
                        return;
                    }
                    break;
                case SLIDER:
                    if (mouseButton == 0 && isOver(mouseX, mouseY - 4, controlX, controlY, controlW, CONTROL_HEIGHT + 8)) {
                        draggingSlider = option;
                        applySlider(option, mouseX, controlX);
                        return;
                    }
                    break;
                case BUTTON:
                    if (mouseButton == 0 && isOver(mouseX, mouseY, controlX, controlY, controlW, CONTROL_HEIGHT)) {
                        option.run();
                        config.save();
                        return;
                    }
                    break;
            }
            break;
        }

        if (mouseButton == 0) {
            draggingContent = true;
            dragAnchorY = mouseY;
            dragAnchorScroll = scroll;
        }
    }

    @Override
    protected void mouseClickMove(int mouseX, int mouseY, int clickedMouseButton, long timeSinceLastClick) {
        if (draggingSlider != null) {
            applySlider(draggingSlider, mouseX, controlLeft(draggingSlider));
        } else if (draggingScrollbar) {
            scrollTo(mouseY);
        } else if (draggingContent) {
            scroll = dragAnchorScroll + (dragAnchorY - mouseY);
            clampScroll();
        }
    }

    @Override
    protected void mouseReleased(int mouseX, int mouseY, int state) {
        super.mouseReleased(mouseX, mouseY, state);
        if (draggingSlider != null) {
            ConfigOption option = draggingSlider;
            draggingSlider = null;
            changed(option);
        }
        draggingScrollbar = false;
        draggingContent = false;
    }

    @Override
    public void handleMouseInput() throws java.io.IOException {
        super.handleMouseInput();
        int wheel = Mouse.getEventDWheel();
        if (wheel == 0) return;
        scroll -= (wheel > 0 ? 1 : -1) * ROW_HEIGHT;
        clampScroll();
    }

    @Override
    protected void keyTyped(char typedChar, int keyCode) throws java.io.IOException {
        if (keyCode == Keyboard.KEY_DOWN) {
            scroll += ROW_HEIGHT;
            clampScroll();
        } else if (keyCode == Keyboard.KEY_UP) {
            scroll -= ROW_HEIGHT;
            clampScroll();
        } else if (keyCode == Keyboard.KEY_NEXT) {
            scroll += contentBottom - contentTop;
            clampScroll();
        } else if (keyCode == Keyboard.KEY_PRIOR) {
            scroll -= contentBottom - contentTop;
            clampScroll();
        } else {
            super.keyTyped(typedChar, keyCode);
        }
    }

    private void scrollTo(int mouseY) {
        int viewport = contentBottom - contentTop;
        if (contentHeight <= viewport) return;
        int thumbHeight = Math.max(16, viewport * viewport / contentHeight);
        int travel = viewport - thumbHeight;
        if (travel <= 0) return;
        int offset = mouseY - contentTop - thumbHeight / 2;
        scroll = offset * (contentHeight - viewport) / travel;
        clampScroll();
    }

    private void cycle(ConfigOption option, int direction) {
        int count = option.options.length;
        if (count == 0) return;
        int index = ((option.getInt() + direction) % count + count) % count;
        option.setInt(index);
        changed(option);
    }

    private void applySlider(ConfigOption option, int mouseX, int controlX) {
        float fraction = (mouseX - controlX) / (float) SLIDER_WIDTH;
        fraction = Math.max(0f, Math.min(1f, fraction));
        float value = option.min + fraction * (option.max - option.min);
        if (option.step > 0) {
            value = Math.round(value / option.step) * (float) option.step;
        } else {
            value = Math.round(value * 100f) / 100f;
        }
        option.setFloat(Math.max(option.min, Math.min(option.max, value)));
        config.onChanged(option.fieldName());
    }

    private void changed(ConfigOption option) {
        config.onChanged(option.fieldName());
        config.save();
    }

    @Override
    public void onGuiClosed() {
        Keyboard.enableRepeatEvents(false);
        config.save();
    }

    @Override
    public boolean doesGuiPauseGame() {
        // Keeping the world ticking lets the live sliders be judged while they're dragged.
        return false;
    }

    // ---------------------------------------------------------------- helpers

    private static boolean isOver(int mouseX, int mouseY, int x, int y, int w, int h) {
        return mouseX >= x && mouseX < x + w && mouseY >= y && mouseY < y + h;
    }

    private static String format(float value, int step) {
        if (step > 0 && value == Math.floor(value)) {
            return String.valueOf((int) value);
        }
        String text = String.format("%.2f", value);
        return text.endsWith("0") ? text.substring(0, text.length() - 1) : text;
    }

    private String trim(String text, int maxWidth) {
        if (fontRendererObj.getStringWidth(text) <= maxWidth) return text;
        return fontRendererObj.trimStringToWidth(text, Math.max(0, maxWidth - fontRendererObj.getStringWidth("..."))) + "...";
    }

    private static final class Tab {
        final String category;
        final int x;
        final int y;
        final int width;

        Tab(String category, int x, int y, int width) {
            this.category = category;
            this.x = x;
            this.y = y;
            this.width = width;
        }
    }

    private static final class Row {
        final String header;
        final ConfigOption option;
        final int y;

        private Row(String header, ConfigOption option, int y) {
            this.header = header;
            this.option = option;
            this.y = y;
        }

        static Row header(String header, int y) {
            return new Row(header, null, y);
        }

        static Row option(ConfigOption option, int y) {
            return new Row(null, option, y);
        }

        boolean isHeader() {
            return option == null;
        }

        int height() {
            return isHeader() ? HEADER_HEIGHT : ROW_HEIGHT;
        }
    }
}
