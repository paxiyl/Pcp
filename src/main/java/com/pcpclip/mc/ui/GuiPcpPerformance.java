package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.Corner;
import com.pcpclip.mc.PcpClipMod;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import java.util.Locale;

/**
 * Performance controls and the live capture status.
 *
 * <p>The status block is the diagnostic surface: measured capture rate against the target, how
 * long the readback is costing the render thread, how long a frame takes to encode, how much is
 * queued and how much has been dropped. If a device cannot keep up, these numbers say so plainly.
 */
public class GuiPcpPerformance extends GuiPcpBase {

    private static final int ID_SAVER = 10;
    private static final int ID_THREADS = 20;
    private static final int ID_MEMORY = 30;
    private static final int ID_SEGMENT = 40;
    private static final int ID_ASYNC = 50;
    private static final int ID_INDICATOR = 51;
    private static final int ID_TOASTS = 60;
    private static final int ID_STATS = 61;

    public GuiPcpPerformance(GuiScreen parent) {
        super(parent, "PcpClip - Performance");
    }

    @Override
    public void initGui() {
        ClipConfig config = config();
        int y = 62;

        y = addRow(ID_SAVER, y, "Performance saver: " + onOff(config.performanceSaver));
        y = addStepper(ID_THREADS, y, "Encoder threads: " + (config.encoderThreads == 0
                ? "automatic (" + config.effectiveEncoderThreads() + ")"
                : Integer.toString(config.encoderThreads)));
        y = addStepper(ID_MEMORY, y, "Capture memory: " + config.captureMemoryBudgetMb + " MB");
        y = addStepper(ID_SEGMENT, y, String.format(Locale.ROOT, "Segment length: %.1f s",
                config.segmentMillis / 1000.0));
        y = addPair(ID_ASYNC, ID_INDICATOR, y,
                "Async readback: " + onOff(config.asyncReadback),
                config.showIndicator ? "Dot: " + config.indicatorCorner.label() : "Dot: off");
        y = addPair(ID_TOASTS, ID_STATS, y,
                "Messages: " + onOff(config.showToasts),
                "Status overlay: " + onOff(config.showStats));
        addDoneButton(y, "Back");

        footerLines.add("The saver lowers capture rate and quality while the game is struggling,"
                + " then raises it again.");
        ClipEngine engine = engine();
        if (engine != null) {
            ClipEngine.Status status = engine.status();
            if (status.requestedFps < status.targetFps) {
                footerLines.add("Capturing at " + status.requestedFps + " fps, not "
                        + status.targetFps + ": the encoder cannot absorb more, and reading frames"
                        + " it would drop costs you FPS for nothing.");
            }
            if (status.timestampAnomalies > 0L) {
                footerLines.add("!" + status.timestampAnomalies
                        + " capture timestamps had to be corrected - please report this.");
            }
        }
        PcpClipMod mod = PcpClipMod.instance();
        if (mod != null && config.performanceSaver) {
            footerLines.add("Capture settings are never changed permanently by the saver.");
        }
    }

    @Override
    public void drawScreen(int mouseX, int mouseY, float partialTicks) {
        super.drawScreen(mouseX, mouseY, partialTicks);
        ClipEngine engine = engine();
        if (engine == null) {
            return;
        }
        ClipEngine.Status status = engine.status();
        String line1 = String.format(Locale.ROOT,
                "%s   captured %.1f fps of %d   dropped %.1f%%   queue %d",
                status.mode.label(), status.measuredFps, status.targetFps, status.dropPercent,
                status.backlog);
        if (status.requestedFps < status.targetFps) {
            line1 = line1 + "   asking " + status.requestedFps;
        }
        String line2 = String.format(Locale.ROOT,
                "readback %.2f ms/frame on the render thread   encode %.0f ms/frame",
                status.readbackMillis, status.encodeMillis);
        String line3 = status.performanceLevel > 0
                ? "Saver active at level " + status.performanceLevel + ": " + status.performanceReason
                : status.backend;

        drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(line1, width - 10),
                width / 2, 26, status.dropPercent > 5.0 ? WARN_COLOUR : VALUE_COLOUR);
        drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(line2, width - 10),
                width / 2, 37, LABEL_COLOUR);
        drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(line3, width - 10),
                width / 2, 48, status.performanceLevel > 0 ? WARN_COLOUR : LABEL_COLOUR);
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipConfig config = config();
        switch (button.id) {
            case ID_SAVER:
                config.performanceSaver = !config.performanceSaver;
                break;
            case ID_THREADS:
                config.encoderThreads = step(config.encoderThreads, -1, 0, 8);
                break;
            case ID_THREADS + 1:
                config.encoderThreads = step(config.encoderThreads, 1, 0, 8);
                break;
            case ID_MEMORY:
                config.captureMemoryBudgetMb = step(config.captureMemoryBudgetMb, -16, 12, 512);
                break;
            case ID_MEMORY + 1:
                config.captureMemoryBudgetMb = step(config.captureMemoryBudgetMb, 16, 12, 512);
                break;
            case ID_SEGMENT:
                config.segmentMillis = step(config.segmentMillis, -500, 500, 10000);
                break;
            case ID_SEGMENT + 1:
                config.segmentMillis = step(config.segmentMillis, 500, 500, 10000);
                break;
            case ID_ASYNC:
                config.asyncReadback = !config.asyncReadback;
                break;
            case ID_INDICATOR: {
                // Off, then each corner in turn.
                if (!config.showIndicator) {
                    config.showIndicator = true;
                    config.indicatorCorner = Corner.TOP_LEFT;
                } else {
                    Corner[] corners = Corner.values();
                    int next = config.indicatorCorner.ordinal() + 1;
                    if (next >= corners.length) {
                        config.showIndicator = false;
                    } else {
                        config.indicatorCorner = corners[next];
                    }
                }
                break;
            }
            case ID_TOASTS:
                config.showToasts = !config.showToasts;
                break;
            case ID_STATS:
                config.showStats = !config.showStats;
                break;
            default:
                break;
        }
        saveSettings();
        refresh();
    }
}
