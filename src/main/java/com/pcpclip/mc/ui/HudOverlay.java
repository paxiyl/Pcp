package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.Corner;
import com.pcpclip.core.util.Fmt;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.FontRenderer;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.client.renderer.GlStateManager;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * The on-screen indicator, the save confirmations and the optional status readout.
 *
 * <p>Kept deliberately small and out of the way: PvP is the main reason to want clips, so the
 * overlay must never cover the crosshair, the hotbar or a touch control. It draws in Minecraft's
 * own GUI coordinate space, so it scales with the player's GUI scale setting like every other
 * element, and it can be switched off entirely.
 *
 * <p>Messages arrive from the export thread, so they queue through a concurrent collection and are
 * only ever drained on the render thread. Nothing here blocks the game, and nothing pauses it.
 */
public final class HudOverlay implements ClipEngine.Events {

    private static final long TOAST_MILLIS = 4500L;
    private static final int MAX_VISIBLE_TOASTS = 3;
    private static final int PANEL_BACKGROUND = 0x90000000;
    private static final int TEXT_COLOUR = 0xFFFFFFFF;
    private static final int RECORDING_COLOUR = 0xFFFF4040;
    private static final int BUFFER_COLOUR = 0xFF40C0FF;
    private static final int WARNING_COLOUR = 0xFFFFC040;

    private final ConcurrentLinkedQueue<Toast> incoming = new ConcurrentLinkedQueue<Toast>();
    private final Deque<Toast> visible = new ArrayDeque<Toast>();

    private static final class Toast {

        final String message;
        final boolean problem;
        long shownAtMillis;

        Toast(String message, boolean problem) {
            this.message = message;
            this.problem = problem;
        }
    }

    @Override
    public void toast(String message) {
        incoming.add(new Toast(message, false));
    }

    @Override
    public void error(String message) {
        incoming.add(new Toast(message, true));
    }

    /** Called at the end of every render tick, after the frame has been captured. */
    public void render(Minecraft mc, ClipEngine engine) {
        ClipConfig config = engine.config();
        drainIncoming();
        if (visible.isEmpty() && (!config.showIndicator || engine.mode() == ClipEngine.Mode.IDLE)
                && !config.showStats) {
            return;                                  // nothing to draw: do not touch GL at all
        }
        if (mc.fontRendererObj == null) {
            return;
        }

        ClipEngine.Status status = engine.status();
        ScaledResolution resolution = new ScaledResolution(mc);
        int screenWidth = resolution.getScaledWidth();
        int screenHeight = resolution.getScaledHeight();

        // Matches the coordinate system the HUD itself uses, so the overlay lines up with it.
        if (mc.entityRenderer != null) {
            mc.entityRenderer.setupOverlayRendering();
        }
        GlStateManager.disableDepth();
        GlStateManager.enableBlend();
        GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);

        if (config.showIndicator && status.mode != ClipEngine.Mode.IDLE) {
            drawIndicator(mc.fontRendererObj, config, status, screenWidth, screenHeight);
        }
        if (config.showStats) {
            drawStats(mc.fontRendererObj, status, screenWidth, screenHeight);
        }
        if (config.showToasts) {
            drawToasts(mc.fontRendererObj, screenWidth);
        }

        GlStateManager.enableDepth();
    }

    private void drainIncoming() {
        Toast arrived;
        while ((arrived = incoming.poll()) != null) {
            arrived.shownAtMillis = System.currentTimeMillis();
            visible.addLast(arrived);
            while (visible.size() > MAX_VISIBLE_TOASTS) {
                visible.removeFirst();
            }
        }
        long now = System.currentTimeMillis();
        while (!visible.isEmpty() && now - visible.peekFirst().shownAtMillis > TOAST_MILLIS) {
            visible.removeFirst();
        }
    }

    /**
     * The indicator: a dot and a short label, about the size of two characters of chat text.
     */
    private void drawIndicator(FontRenderer font, ClipConfig config, ClipEngine.Status status,
                               int screenWidth, int screenHeight) {
        String label;
        int colour;
        switch (status.mode) {
            case RECORDING:
                label = "REC";
                colour = RECORDING_COLOUR;
                break;
            case PAUSED:
                label = "PAUSE";
                colour = WARNING_COLOUR;
                break;
            default:
                label = "BUF";
                colour = BUFFER_COLOUR;
                break;
        }
        if (status.performanceLevel > 0) {
            label = label + " -" + status.performanceLevel;
        }

        int textWidth = font.getStringWidth(label);
        int panelWidth = textWidth + 14;
        int panelHeight = 11;
        int margin = 3;

        int x;
        int y;
        Corner corner = config.indicatorCorner;
        if (corner == Corner.TOP_RIGHT || corner == Corner.BOTTOM_RIGHT) {
            x = screenWidth - panelWidth - margin;
        } else {
            x = margin;
        }
        if (corner == Corner.BOTTOM_LEFT || corner == Corner.BOTTOM_RIGHT) {
            // Stay clear of the chat line and the hotbar.
            y = screenHeight - panelHeight - margin - 12;
        } else {
            y = margin;
        }

        Gui.drawRect(x, y, x + panelWidth, y + panelHeight, PANEL_BACKGROUND);
        Gui.drawRect(x + 3, y + 4, x + 7, y + 8, colour);
        font.drawStringWithShadow(label, x + 10, y + 2, colour);
    }

    private void drawStats(FontRenderer font, ClipEngine.Status status, int screenWidth,
                           int screenHeight) {
        String[] lines = {
                status.mode.label() + "  " + status.outputWidth + "x" + status.outputHeight
                        + "  " + String.format(Locale.ROOT, "%.0f/%d fps",
                        status.measuredFps, status.targetFps),
                "buffer " + String.format(Locale.ROOT, "%.0f", status.bufferedSeconds) + "/"
                        + status.bufferSeconds + "s  " + Fmt.bytes(status.bufferBytes),
                "drops " + String.format(Locale.ROOT, "%.0f%%", status.dropPercent)
                        + "  queue " + status.backlog
                        + "  read " + String.format(Locale.ROOT, "%.1fms", status.readbackMillis)
                        + "  enc " + String.format(Locale.ROOT, "%.0fms", status.encodeMillis),
                status.backend,
        };

        int width = 0;
        for (String line : lines) {
            width = Math.max(width, font.getStringWidth(line));
        }
        int x = 3;
        int y = screenHeight - lines.length * 10 - 16;
        Gui.drawRect(x - 2, y - 2, x + width + 2, y + lines.length * 10, PANEL_BACKGROUND);
        for (int i = 0; i < lines.length; i++) {
            int colour = status.dropPercent > 5.0 && i == 2 ? WARNING_COLOUR : TEXT_COLOUR;
            font.drawStringWithShadow(lines[i], x, y + i * 10, colour);
        }
    }

    /** Save confirmations, top-centre, small, and gone on their own after a few seconds. */
    private void drawToasts(FontRenderer font, int screenWidth) {
        int y = 4;
        for (Toast toast : visible) {
            String text = font.trimStringToWidth(toast.message, Math.max(80, screenWidth - 20));
            int width = font.getStringWidth(text);
            int x = (screenWidth - width) / 2;
            Gui.drawRect(x - 4, y - 2, x + width + 4, y + 10, PANEL_BACKGROUND);
            font.drawStringWithShadow(text, x, y, toast.problem ? WARNING_COLOUR : TEXT_COLOUR);
            y += 13;
        }
    }
}
