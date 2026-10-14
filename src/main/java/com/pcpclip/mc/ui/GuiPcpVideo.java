package com.pcpclip.mc.ui;

import com.pcpclip.core.ClipEngine;
import com.pcpclip.core.codec.EncoderCapabilities;
import com.pcpclip.core.codec.EncoderSpec;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.config.AspectPreset;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.config.ResolutionPreset;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.util.Fmt;

import net.minecraft.client.gui.GuiButton;
import net.minecraft.client.gui.GuiScreen;

/**
 * Resolution, aspect ratio, frame rate, fit and encoder.
 *
 * <p>Every change immediately restates the consequences underneath: the real output dimensions,
 * what a clip of the current length will cost on disk, and whether this device can be expected to
 * keep up. Choosing 1080p at 120 fps is allowed - being told it will drop most of its frames is
 * the point.
 */
public class GuiPcpVideo extends GuiPcpBase {

    private static final int ID_RESOLUTION = 10;
    private static final int ID_ASPECT = 11;
    private static final int ID_FPS = 20;                 // stepper
    private static final int ID_FIT = 30;
    private static final int ID_ENCODER = 31;
    private static final int ID_QUALITY = 40;             // stepper
    private static final int ID_FIXED_RATE = 50;
    private static final int ID_CUSTOM = 51;

    private static final int[] FPS_CHOICES = {15, 20, 24, 30, 48, 60, 90, 120, 144, 240};

    public GuiPcpVideo(GuiScreen parent) {
        super(parent, "PcpClip - Video");
    }

    @Override
    public void initGui() {
        ClipConfig config = config();
        int y = 30;

        y = addPair(ID_RESOLUTION, ID_ASPECT, y,
                config.resolutionPreset.label(), config.aspectPreset.label());
        y = addStepper(ID_FPS, y, "Frame rate: " + config.targetFps + " fps");
        y = addRow(ID_FIT, y, "Shape: " + config.fitMode.label());
        y = addRow(ID_ENCODER, y, "Encoder: " + config.encoder.label());
        y = addStepper(ID_QUALITY, y, qualityLabel(config));
        y = addPair(ID_FIXED_RATE, ID_CUSTOM, y,
                "Fixed rate: " + onOff(config.fixedFrameRateExport), "Custom sizes");
        addDoneButton(y, "Back");

        describeOutcome(config);
    }

    private static String qualityLabel(ClipConfig config) {
        EncoderPreference resolved = config.encoder;
        if (resolved == EncoderPreference.MJPEG_AVI) {
            return "JPEG quality: " + config.jpegQuality;
        }
        if (resolved == EncoderPreference.H264_MP4) {
            return "H.264 quality: qp " + config.h264Qp + " (lower is better)";
        }
        return "Bitrate: " + config.bitrateKbps + " kbps";
    }

    /** The honest part: what this preset will actually produce, and what it will cost. */
    private void describeOutcome(ClipConfig config) {
        ClipEngine engine = engine();
        OutputGeometry geometry = engine != null ? engine.currentGeometry() : null;
        if (geometry == null) {
            return;
        }
        int workers = config.effectiveEncoderThreads();
        EncoderSpec spec = EncoderSpec.from(config, geometry.outWidth, geometry.outHeight);
        EncoderCapabilities capabilities = EncoderCapabilities.get();
        EncoderPreference resolved = config.encoder == EncoderPreference.AUTO
                ? capabilities.autoChoice(spec.pixelRate(), workers) : config.encoder;

        StringBuilder shape = new StringBuilder();
        shape.append("Output ").append(geometry.outWidth).append("x").append(geometry.outHeight);
        if (geometry.cropped) {
            shape.append(", cropped from ").append(geometry.srcWidth).append("x")
                    .append(geometry.srcHeight);
        } else if (geometry.needsBackgroundFill()) {
            shape.append(", with black bars (nothing is cut off)");
        }
        footerLines.add(shape.toString());

        // Cropping hard enough to reach the HUD is worth saying out loud: at 21:9 a quarter of
        // the height goes, which is where the hotbar and the health bar live.
        if (geometry.cropped && engine != null) {
            int trimmedRows = Math.max(0, pixelsTrimmedVertically(geometry));
            int percent = Math.round(trimmedRows * 100.0F / Math.max(1, sourceHeight(geometry)));
            if (percent >= 10) {
                footerLines.add("!Crop removes " + percent
                        + "% of the height - the hotbar and health bar may be cut off. "
                        + "'Fit with bars' keeps the whole screen.");
            }
        }

        SegmentCodec codec = resolved == EncoderPreference.MJPEG_AVI
                ? SegmentCodec.MJPEG : SegmentCodec.H264;
        long estimate = engine.storage().estimateClipBytes(config.clipSeconds, geometry.outWidth,
                geometry.outHeight, config.targetFps, codec, 0L);
        footerLines.add("A " + config.clipSeconds + "s clip is roughly " + Fmt.bytes(estimate)
                + " as " + codec.containerExtension().toUpperCase()
                + "; buffer needs about " + Fmt.bytes(estimate * config.shadowBufferSeconds
                / Math.max(1, config.clipSeconds)));

        String note = capabilities.sustainabilityNote(resolved, spec.pixelRate(), workers);
        footerLines.add((note.startsWith("Likely too demanding") ? "!" : "+") + note);
    }

    private static int pixelsTrimmedVertically(OutputGeometry geometry) {
        return geometry.srcY * 2;
    }

    private static int sourceHeight(OutputGeometry geometry) {
        return geometry.srcHeight + geometry.srcY * 2;
    }

    @Override
    protected void onAction(GuiButton button) {
        ClipConfig config = config();
        switch (button.id) {
            case ID_RESOLUTION: {
                ResolutionPreset[] values = ResolutionPreset.values();
                config.resolutionPreset = values[cycleIndex(config.resolutionPreset.ordinal(),
                        values.length, 1)];
                break;
            }
            case ID_ASPECT: {
                AspectPreset[] values = AspectPreset.values();
                config.aspectPreset = values[cycleIndex(config.aspectPreset.ordinal(),
                        values.length, 1)];
                break;
            }
            case ID_FPS:
                config.targetFps = neighbour(config.targetFps, -1);
                break;
            case ID_FPS + 1:
                config.targetFps = neighbour(config.targetFps, 1);
                break;
            case ID_FIT: {
                // Only the two supported modes are offered; the unavailable one is documented.
                config.fitMode = config.fitMode == FitMode.CROP ? FitMode.LETTERBOX : FitMode.CROP;
                break;
            }
            case ID_ENCODER: {
                EncoderPreference[] values = EncoderPreference.values();
                config.encoder = values[cycleIndex(config.encoder.ordinal(), values.length, 1)];
                break;
            }
            case ID_QUALITY:
                adjustQuality(config, -5);
                break;
            case ID_QUALITY + 1:
                adjustQuality(config, 5);
                break;
            case ID_FIXED_RATE:
                config.fixedFrameRateExport = !config.fixedFrameRateExport;
                break;
            case ID_CUSTOM:
                saveSettings();
                mc.displayGuiScreen(new GuiPcpCustomSize(this));
                return;
            default:
                break;
        }
        saveSettings();
        refresh();
    }

    private static void adjustQuality(ClipConfig config, int delta) {
        if (config.encoder == EncoderPreference.MJPEG_AVI) {
            config.jpegQuality = step(config.jpegQuality, delta, 10, 100);
        } else if (config.encoder == EncoderPreference.H264_MP4) {
            // Quantiser runs the other way: a bigger number is worse, so invert the step.
            config.h264Qp = step(config.h264Qp, -delta / 5 * 2, 10, 40);
        } else {
            config.bitrateKbps = step(config.bitrateKbps, delta * 200, 250, 60000);
        }
    }

    private static int neighbour(int fps, int direction) {
        if (direction > 0) {
            for (int choice : FPS_CHOICES) {
                if (choice > fps) {
                    return choice;
                }
            }
            return FPS_CHOICES[FPS_CHOICES.length - 1];
        }
        int best = FPS_CHOICES[0];
        for (int choice : FPS_CHOICES) {
            if (choice < fps) {
                best = choice;
            }
        }
        return best;
    }
}
