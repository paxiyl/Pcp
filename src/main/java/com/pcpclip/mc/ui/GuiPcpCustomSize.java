package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.config.AspectPreset;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.ResolutionPreset;
import com.pcpclip.core.geom.OutputGeometry;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

import java.util.List;

/**
 * Custom output dimensions and custom aspect ratios.
 *
 * <p>Values are stepped rather than typed: entering four digits with an on-screen keyboard while
 * a game is running is miserable, and stepping cannot produce an invalid value in the first place.
 * Anything out of range is still clamped and reported by {@link ClipConfig#validate()}.
 */
public class GuiPcpCustomSize extends GuiPcpBase {

    private static final int ID_WIDTH_COARSE = 10;
    private static final int ID_WIDTH_FINE = 20;
    private static final int ID_HEIGHT_COARSE = 30;
    private static final int ID_HEIGHT_FINE = 40;
    private static final int ID_ASPECT_W = 50;
    private static final int ID_ASPECT_H = 60;
    private static final int ID_USE_CUSTOM_SIZE = 70;
    private static final int ID_USE_CUSTOM_ASPECT = 71;

    public GuiPcpCustomSize(GuiScreen parent) {
        super(parent, "PcpClip - Custom size");
    }

    @Override
    public void initGui() {
        ClipConfig config = config();
        int y = 28;
        y = addStepper(ID_WIDTH_COARSE, y, "Width: " + config.customWidth + " (step 160)");
        y = addStepper(ID_WIDTH_FINE, y, "Width fine (step 16)");
        y = addStepper(ID_HEIGHT_COARSE, y, "Height: " + config.customHeight + " (step 90)");
        y = addStepper(ID_HEIGHT_FINE, y, "Height fine (step 16)");
        y = addStepper(ID_ASPECT_W, y, "Custom aspect: " + config.customAspectWidth + ":"
                + config.customAspectHeight + "  (width)");
        y = addStepper(ID_ASPECT_H, y, "Custom aspect height");
        y = addPair(ID_USE_CUSTOM_SIZE, ID_USE_CUSTOM_ASPECT, y,
                config.resolutionPreset == ResolutionPreset.CUSTOM ? "Using custom size"
                        : "Use custom size",
                config.aspectPreset == AspectPreset.CUSTOM ? "Using custom aspect"
                        : "Use custom aspect");
        addDoneButton(y, "Back");

        ClipEngine engine = engine();
        if (engine != null) {
            OutputGeometry geometry = engine.currentGeometry();
            footerLines.add("Encoded frame will be " + geometry.outWidth + "x" + geometry.outHeight
                    + " (even numbers only; H.264 requires it)");
            List<String> problems = config.validationMessages();
            if (!problems.isEmpty()) {
                footerLines.add("!" + problems.get(0));
            }
        }
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipConfig config = config();
        switch (button.id) {
            case ID_WIDTH_COARSE:
                config.customWidth = step(config.customWidth, -160, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_WIDTH_COARSE + 1:
                config.customWidth = step(config.customWidth, 160, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_WIDTH_FINE:
                config.customWidth = step(config.customWidth, -16, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_WIDTH_FINE + 1:
                config.customWidth = step(config.customWidth, 16, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_HEIGHT_COARSE:
                config.customHeight = step(config.customHeight, -90, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_HEIGHT_COARSE + 1:
                config.customHeight = step(config.customHeight, 90, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_HEIGHT_FINE:
                config.customHeight = step(config.customHeight, -16, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_HEIGHT_FINE + 1:
                config.customHeight = step(config.customHeight, 16, ClipConfig.MIN_DIMENSION,
                        ClipConfig.MAX_DIMENSION);
                break;
            case ID_ASPECT_W:
                config.customAspectWidth = step(config.customAspectWidth, -1, 1, 100);
                break;
            case ID_ASPECT_W + 1:
                config.customAspectWidth = step(config.customAspectWidth, 1, 1, 100);
                break;
            case ID_ASPECT_H:
                config.customAspectHeight = step(config.customAspectHeight, -1, 1, 100);
                break;
            case ID_ASPECT_H + 1:
                config.customAspectHeight = step(config.customAspectHeight, 1, 1, 100);
                break;
            case ID_USE_CUSTOM_SIZE:
                config.resolutionPreset = config.resolutionPreset == ResolutionPreset.CUSTOM
                        ? ResolutionPreset.P720 : ResolutionPreset.CUSTOM;
                break;
            case ID_USE_CUSTOM_ASPECT:
                config.aspectPreset = config.aspectPreset == AspectPreset.CUSTOM
                        ? AspectPreset.R16_9 : AspectPreset.CUSTOM;
                break;
            default:
                break;
        }
        config.validate();
        saveSettings();
        refresh();
    }
}
