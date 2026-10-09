package dev.paxiyl.pcp.client;

import dev.paxiyl.pcp.config.PcpConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.ScaledResolution;
import net.minecraft.client.renderer.GlStateManager;

/**
 * Compact diagnostic overlay.
 *
 * <p>Lines are composed once per tick by {@link PcpClient} and only drawn here,
 * so the render path does no string formatting - this has to stay cheap on
 * phones. Drawing uses nothing but {@code Gui.drawRect} and the vanilla font
 * renderer, which keeps it safe under PojavLauncher's GL translation layer, and
 * GL state is restored before returning.</p>
 *
 * <p>Every value is tagged with where it came from: {@code msr} for a
 * measurement, {@code est} for an estimate, {@code prior} for an untested
 * default. Nothing is presented as more certain than it is.</p>
 */
public final class DebugOverlay extends Gui {

    private static final int MAX_LINES = 9;
    private static final int BG_COLOUR = 0x80000000;
    private static final int TEXT_COLOUR = 0xFFE0E0E0;
    private static final int LINE_HEIGHT = 10;

    private final PcpConfig config;
    private final String[] lines = new String[MAX_LINES];
    private int lineCount;

    public DebugOverlay(PcpConfig config) {
        this.config = config;
    }

    public void begin() {
        this.lineCount = 0;
    }

    public void add(String line) {
        if (line != null && this.lineCount < MAX_LINES) {
            this.lines[this.lineCount++] = line;
        }
    }

    public void render(Minecraft mc) {
        if (!this.config.core().debugOverlay || this.lineCount == 0 || mc == null || mc.fontRendererObj == null) {
            return;
        }

        ScaledResolution res = new ScaledResolution(mc);
        int widest = 0;
        for (int i = 0; i < this.lineCount; i++) {
            int w = mc.fontRendererObj.getStringWidth(this.lines[i]);
            if (w > widest) {
                widest = w;
            }
        }

        int boxWidth = widest + 8;
        int boxHeight = this.lineCount * LINE_HEIGHT + 5;
        int margin = this.config.overlayMargin;
        int x;
        int y;
        switch (this.config.overlayCorner) {
            case 1:
                x = res.getScaledWidth() - boxWidth - margin;
                y = margin;
                break;
            case 2:
                x = margin;
                y = res.getScaledHeight() - boxHeight - margin;
                break;
            case 3:
                x = res.getScaledWidth() - boxWidth - margin;
                y = res.getScaledHeight() - boxHeight - margin;
                break;
            case 0:
            default:
                x = margin;
                y = margin;
                break;
        }

        GlStateManager.pushMatrix();
        GlStateManager.enableBlend();
        GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);
        drawRect(x, y, x + boxWidth, y + boxHeight, BG_COLOUR);
        for (int i = 0; i < this.lineCount; i++) {
            mc.fontRendererObj.drawStringWithShadow(this.lines[i], x + 4, y + 3 + i * LINE_HEIGHT, TEXT_COLOUR);
        }
        GlStateManager.color(1.0F, 1.0F, 1.0F, 1.0F);
        GlStateManager.disableBlend();
        GlStateManager.popMatrix();
    }
}
