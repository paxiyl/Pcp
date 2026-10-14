package com.pcpclip.core.geom;

import com.pcpclip.core.config.FitMode;

/**
 * Maps the live framebuffer onto an output frame of a possibly different shape.
 *
 * <p>This is where the "never stretch the game" promise is kept. The source rectangle and the
 * destination rectangle always have the same aspect ratio to within one pixel of rounding, so the
 * scale applied horizontally equals the scale applied vertically. Ultrawide output therefore
 * either crops away the top and bottom of the rendered frame ({@link FitMode#CROP}) or adds black
 * bars ({@link FitMode#LETTERBOX}) - the HUD, crosshair, hotbar, text and inventory keep their
 * proportions in both cases.
 *
 * <p>Rectangles use GL conventions: the origin is bottom-left of the framebuffer.
 */
public final class OutputGeometry {

    /** Encoded frame size. Always even, because H.264 chroma is subsampled by two. */
    public final int outWidth;
    public final int outHeight;

    /** Region of the source framebuffer that is kept. */
    public final int srcX;
    public final int srcY;
    public final int srcWidth;
    public final int srcHeight;

    /** Where that region lands inside the output frame. */
    public final int dstX;
    public final int dstY;
    public final int dstWidth;
    public final int dstHeight;

    /** Uniform scale factor from source pixels to output pixels. */
    public final double scale;

    public final boolean cropped;
    public final boolean letterboxed;
    public final boolean pillarboxed;

    private OutputGeometry(int outWidth, int outHeight,
                           int srcX, int srcY, int srcWidth, int srcHeight,
                           int dstX, int dstY, int dstWidth, int dstHeight,
                           double scale, boolean cropped) {
        this.outWidth = outWidth;
        this.outHeight = outHeight;
        this.srcX = srcX;
        this.srcY = srcY;
        this.srcWidth = srcWidth;
        this.srcHeight = srcHeight;
        this.dstX = dstX;
        this.dstY = dstY;
        this.dstWidth = dstWidth;
        this.dstHeight = dstHeight;
        this.scale = scale;
        this.cropped = cropped;
        this.letterboxed = dstHeight < outHeight;
        this.pillarboxed = dstWidth < outWidth;
    }

    /**
     * @param sourceWidth    framebuffer width in pixels
     * @param sourceHeight   framebuffer height in pixels
     * @param requestedWidth desired output width
     * @param requestedHeight desired output height
     * @param mode           crop or letterbox; unsupported modes resolve to letterbox
     */
    public static OutputGeometry compute(int sourceWidth, int sourceHeight,
                                         int requestedWidth, int requestedHeight, FitMode mode) {
        int srcW = Math.max(1, sourceWidth);
        int srcH = Math.max(1, sourceHeight);
        int outW = even(Math.max(2, requestedWidth));
        int outH = even(Math.max(2, requestedHeight));

        double sourceAspect = (double) srcW / srcH;
        double outputAspect = (double) outW / outH;

        if (mode.resolveSupported() == FitMode.CROP) {
            int cropW;
            int cropH;
            if (sourceAspect > outputAspect) {
                // Source is wider than the output: keep full height, trim the sides.
                cropH = srcH;
                cropW = (int) Math.round(srcH * outputAspect);
                cropW = Math.max(2, Math.min(cropW, srcW));
            } else {
                // Source is taller than the output: keep full width, trim top and bottom.
                cropW = srcW;
                cropH = (int) Math.round(srcW / outputAspect);
                cropH = Math.max(2, Math.min(cropH, srcH));
            }
            int cropX = (srcW - cropW) / 2;
            int cropY = (srcH - cropH) / 2;
            boolean cropped = cropW < srcW || cropH < srcH;
            return new OutputGeometry(outW, outH, cropX, cropY, cropW, cropH,
                    0, 0, outW, outH, (double) outW / cropW, cropped);
        }

        // Letterbox: the whole frame is kept and scaled uniformly to fit inside the output.
        double fit = Math.min((double) outW / srcW, (double) outH / srcH);
        int dstW = even(Math.max(2, Math.min(outW, (int) Math.round(srcW * fit))));
        int dstH = even(Math.max(2, Math.min(outH, (int) Math.round(srcH * fit))));
        int dstX = (outW - dstW) / 2;
        int dstY = (outH - dstH) / 2;
        return new OutputGeometry(outW, outH, 0, 0, srcW, srcH, dstX, dstY, dstW, dstH, fit, false);
    }

    /**
     * Geometry for frames the GPU has already cropped and scaled: the buffer is exactly the output
     * frame, so the conversion step only has to flip rows.
     */
    public static OutputGeometry identity(int width, int height) {
        int w = even(Math.max(2, width));
        int h = even(Math.max(2, height));
        return new OutputGeometry(w, h, 0, 0, w, h, 0, 0, w, h, 1.0, false);
    }

    /** True when the output frame has regions no source pixel maps to, which must be cleared. */
    public boolean needsBackgroundFill() {
        return dstX > 0 || dstY > 0 || dstWidth < outWidth || dstHeight < outHeight;
    }

    /** Aspect ratio distortion as a ratio of the two scale factors; 1.0 means perfectly uniform. */
    public double distortion() {
        double horizontal = (double) dstWidth / srcWidth;
        double vertical = (double) dstHeight / srcHeight;
        return horizontal / vertical;
    }

    public long bytesPerCapturedFrame() {
        return (long) srcWidth * srcHeight * 4L;
    }

    @Override
    public String toString() {
        return "out=" + outWidth + "x" + outHeight
                + " src=" + srcWidth + "x" + srcHeight + "+" + srcX + "+" + srcY
                + " dst=" + dstWidth + "x" + dstHeight + "+" + dstX + "+" + dstY
                + (cropped ? " cropped" : "")
                + (letterboxed ? " letterboxed" : "")
                + (pillarboxed ? " pillarboxed" : "");
    }

    private static int even(int value) {
        return (value & 1) == 0 ? value : value - 1;
    }
}
