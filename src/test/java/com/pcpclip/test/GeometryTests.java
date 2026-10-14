package com.pcpclip.test;

import com.pcpclip.core.config.AspectPreset;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.config.ResolutionPreset;
import com.pcpclip.core.geom.OutputGeometry;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkEquals;
import static com.pcpclip.test.TestSupport.checkNear;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/**
 * The "never stretch the game" guarantee, checked arithmetically.
 *
 * <p>Distortion is the horizontal scale divided by the vertical scale. Anything other than 1.0
 * means the picture - and therefore the HUD, crosshair and inventory - would be squashed.
 */
final class GeometryTests {

    private GeometryTests() {
    }

    /** Phone framebuffers worth testing, including tall and short ones. */
    private static final int[][] SOURCES = {
            {1920, 1080},   // 16:9 landscape
            {2400, 1080},   // 20:9, common phone
            {2340, 1080},   // 19.5:9
            {1600, 720},    // 20:9 lower end
            {1080, 2400},   // portrait
            {1024, 768},    // 4:3 tablet
            {2560, 1600},   // 16:10 tablet
            {1281, 721},    // deliberately odd
    };

    private static final int[][] OUTPUTS = {
            {1280, 720}, {1920, 1080}, {2520, 1080}, {3840, 1080},
            {1440, 1080}, {1080, 1080}, {608, 1080}, {854, 480},
    };

    static void run() {
        startTest("geometry: no distortion in any source/output combination");
        int combinations = 0;
        for (int[] source : SOURCES) {
            for (int[] output : OUTPUTS) {
                for (FitMode mode : new FitMode[]{FitMode.CROP, FitMode.LETTERBOX}) {
                    OutputGeometry geometry = OutputGeometry.compute(source[0], source[1],
                            output[0], output[1], mode);
                    combinations++;

                    // Uniform scaling: the only acceptable answer is 1.0 within pixel rounding.
                    checkNear(1.0, geometry.distortion(), 0.01,
                            "uniform scale for " + source[0] + "x" + source[1] + " -> "
                                    + output[0] + "x" + output[1] + " " + mode);

                    check(geometry.outWidth % 2 == 0 && geometry.outHeight % 2 == 0,
                            "output dimensions are even (H.264 needs that)");
                    check(geometry.srcX >= 0 && geometry.srcY >= 0, "crop origin is inside the frame");
                    check(geometry.srcX + geometry.srcWidth <= source[0],
                            "crop width stays inside the source");
                    check(geometry.srcY + geometry.srcHeight <= source[1],
                            "crop height stays inside the source");
                    check(geometry.dstX + geometry.dstWidth <= geometry.outWidth,
                            "placement stays inside the output");
                    check(geometry.dstY + geometry.dstHeight <= geometry.outHeight,
                            "placement stays inside the output");

                    if (mode == FitMode.CROP) {
                        check(!geometry.needsBackgroundFill(), "crop mode fills the whole frame");
                    } else {
                        check(geometry.srcWidth == source[0] && geometry.srcHeight == source[1],
                                "letterbox keeps the entire rendered frame");
                    }
                }
            }
        }
        note(combinations + " source/output/mode combinations checked");

        startTest("geometry: ultrawide crops the right axis");
        OutputGeometry ultrawide = OutputGeometry.compute(1920, 1080, 2520, 1080, FitMode.CROP);
        checkEquals(1920, ultrawide.srcWidth, "21:9 from 16:9 keeps full width");
        check(ultrawide.srcHeight < 1080, "21:9 from 16:9 trims height, not width");
        checkNear(2520.0 / 1080.0, (double) ultrawide.srcWidth / ultrawide.srcHeight, 0.01,
                "crop rectangle matches the output ratio");

        OutputGeometry vertical = OutputGeometry.compute(1920, 1080, 608, 1080, FitMode.CROP);
        checkEquals(1080, vertical.srcHeight, "9:16 from 16:9 keeps full height");
        check(vertical.srcWidth < 1920, "9:16 from 16:9 trims width");

        startTest("geometry: letterbox adds bars instead of stretching");
        OutputGeometry letterboxed = OutputGeometry.compute(1920, 1080, 1080, 1080, FitMode.LETTERBOX);
        check(letterboxed.letterboxed, "square output from 16:9 has top and bottom bars");
        check(!letterboxed.pillarboxed, "no side bars needed");
        checkEquals(1080, letterboxed.dstWidth, "scaled width fills the square");
        checkNear(1920.0 / 1080.0, (double) letterboxed.dstWidth / letterboxed.dstHeight, 0.02,
                "placed rectangle keeps the source ratio");

        startTest("geometry: identity transform for GPU-scaled frames");
        OutputGeometry identity = OutputGeometry.identity(1280, 720);
        checkEquals(1280, identity.srcWidth, "identity source width");
        checkEquals(720, identity.dstHeight, "identity destination height");
        checkNear(1.0, identity.distortion(), 0.0001, "identity has no distortion");
        check(!identity.needsBackgroundFill(), "identity covers the frame");

        startTest("config: output size derivation");
        ClipConfig config = new ClipConfig();
        config.resolutionPreset = ResolutionPreset.P1080;
        config.aspectPreset = AspectPreset.R16_9;
        int[] size = config.outputSize(2400, 1080);
        checkEquals(1920, size[0], "1080p 16:9 width");
        checkEquals(1080, size[1], "1080p 16:9 height");

        config.aspectPreset = AspectPreset.R21_9;
        size = config.outputSize(2400, 1080);
        checkEquals(2520, size[0], "1080p 21:9 width is the documented 2520");
        checkEquals(1080, size[1], "1080p 21:9 height");

        config.aspectPreset = AspectPreset.R9_16;
        size = config.outputSize(2400, 1080);
        checkEquals(608, size[0], "1080p 9:16 width rounds to an even 608");

        config.aspectPreset = AspectPreset.MATCH_SCREEN;
        size = config.outputSize(2400, 1080);
        checkEquals(2400, size[0], "match-screen reproduces the framebuffer ratio");

        config.resolutionPreset = ResolutionPreset.P720;
        config.aspectPreset = AspectPreset.R16_9;
        size = config.outputSize(2400, 1080);
        checkEquals(1280, size[0], "720p 16:9 width");
        checkEquals(720, size[1], "720p 16:9 height");

        config.resolutionPreset = ResolutionPreset.CUSTOM;
        config.customWidth = 1281;
        config.customHeight = 721;
        size = config.outputSize(2400, 1080);
        checkEquals(1280, size[0], "custom odd width is rounded down to even");
        checkEquals(720, size[1], "custom odd height is rounded down to even");
    }
}
