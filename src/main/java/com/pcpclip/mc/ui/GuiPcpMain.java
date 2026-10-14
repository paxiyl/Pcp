package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.util.Fmt;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import java.util.Locale;

/**
 * The main PcpClip screen: what is happening right now, the two controls people use most, and the
 * way into everything else.
 */
public class GuiPcpMain extends GuiPcpBase {

    private static final int ID_BUFFER_TOGGLE = 10;
    private static final int ID_BUFFER_LENGTH = 20;      // stepper: 20 minus, 21 plus, 22 label
    private static final int ID_CLIP_LENGTH = 30;
    private static final int ID_SAVE_NOW = 40;
    private static final int ID_RECORD = 41;
    private static final int ID_VIDEO = 50;
    private static final int ID_PERFORMANCE = 51;
    private static final int ID_STORAGE = 52;

    public GuiPcpMain(GuiScreen parent) {
        super(parent, "PcpClip");
    }

    @Override
    public void initGui() {
        ClipConfig config = config();
        ClipEngine engine = engine();
        int y = 58;

        y = addRow(ID_BUFFER_TOGGLE, y, "Instant replay buffer: " + onOff(config.shadowBuffer));
        y = addStepper(ID_BUFFER_LENGTH, y, "Buffer: " + config.shadowBufferSeconds + " s");
        y = addStepper(ID_CLIP_LENGTH, y, "Clip length: " + config.clipSeconds + " s");

        boolean recording = engine != null && engine.status().recording();
        y = addPair(ID_SAVE_NOW, ID_RECORD, y,
                "Save last " + config.clipSeconds + "s",
                recording ? "Stop recording" : "Record");
        y = addPair(ID_VIDEO, ID_PERFORMANCE, y, "Video", "Performance");
        y = addPair(ID_STORAGE, DONE_ID, y, "Storage & clips", "Done");

        if (engine != null) {
            ClipEngine.Status status = engine.status();
            footerLines.add("Hotkeys: F6 save clip, F7 save again, F8 record, F9 this menu"
                    + " (rebind in Controls)");
            if (!config.shadowBuffer) {
                footerLines.add("Buffer is off: the mod does no per-frame work at all.");
            } else if (status.dropPercent > 5.0) {
                footerLines.add("!Dropping " + Math.round(status.dropPercent)
                        + "% of frames - lower the resolution or frame rate.");
            }
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
        String line1 = status.mode.label()
                + "   " + status.outputWidth + "x" + status.outputHeight
                + "   " + status.targetFps + " fps target";
        String line2;
        if (status.mode == ClipEngine.Mode.IDLE) {
            line2 = status.backend + "   " + status.freeSpace;
        } else {
            line2 = String.format(Locale.ROOT, "%.0f fps captured   buffer %.0f/%ds (%s)   %.0f%% dropped",
                    status.measuredFps, status.bufferedSeconds, status.bufferSeconds,
                    Fmt.bytes(status.bufferBytes), status.dropPercent);
        }
        drawCenteredString(fontRendererObj, line1, width / 2, 28, VALUE_COLOUR);
        drawCenteredString(fontRendererObj, fontRendererObj.trimStringToWidth(line2, width - 16),
                width / 2, 40, LABEL_COLOUR);
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipConfig config = config();
        ClipEngine engine = engine();
        switch (button.id) {
            case ID_BUFFER_TOGGLE:
                config.shadowBuffer = !config.shadowBuffer;
                saveSettings();
                break;
            case ID_BUFFER_LENGTH:
                config.shadowBufferSeconds = previousChoice(config.shadowBufferSeconds);
                config.clipSeconds = Math.min(config.clipSeconds, config.shadowBufferSeconds);
                saveSettings();
                break;
            case ID_BUFFER_LENGTH + 1:
                config.shadowBufferSeconds = nextChoice(config.shadowBufferSeconds);
                saveSettings();
                break;
            case ID_CLIP_LENGTH:
                config.clipSeconds = previousChoice(config.clipSeconds);
                saveSettings();
                break;
            case ID_CLIP_LENGTH + 1:
                config.clipSeconds = Math.min(nextChoice(config.clipSeconds),
                        config.shadowBufferSeconds);
                saveSettings();
                break;
            case ID_SAVE_NOW:
                if (engine != null) {
                    engine.saveRollingClip(config.clipSeconds);
                    mc.displayGuiScreen(null);
                    return;
                }
                break;
            case ID_RECORD:
                if (engine != null) {
                    if (engine.status().recording()) {
                        engine.stopRecording();
                    } else {
                        engine.startRecording();
                        mc.displayGuiScreen(null);
                        return;
                    }
                }
                break;
            case ID_VIDEO:
                mc.displayGuiScreen(new GuiPcpVideo(this));
                return;
            case ID_PERFORMANCE:
                mc.displayGuiScreen(new GuiPcpPerformance(this));
                return;
            case ID_STORAGE:
                mc.displayGuiScreen(new GuiPcpStorage(this));
                return;
            default:
                break;
        }
        refresh();
    }

    /** Steps through the documented clip lengths, then in 15 second increments. */
    private static int nextChoice(int seconds) {
        int[] choices = ClipConfig.CLIP_DURATION_CHOICES;
        for (int choice : choices) {
            if (choice > seconds) {
                return choice;
            }
        }
        return Math.min(ClipConfig.MAX_BUFFER_SECONDS, seconds + 30);
    }

    private static int previousChoice(int seconds) {
        int[] choices = ClipConfig.CLIP_DURATION_CHOICES;
        int best = ClipConfig.MIN_BUFFER_SECONDS;
        for (int choice : choices) {
            if (choice < seconds) {
                best = choice;
            }
        }
        return best;
    }
}
