package com.pcpclip.core.codec;

import com.pcpclip.core.geom.OutputGeometry;

import java.nio.ByteBuffer;

/**
 * Pixel format conversion, run on encoder worker threads only.
 *
 * <p>Three jobs are fused into a single pass to avoid intermediate copies: the vertical flip (GL
 * hands us bottom-up rows), the crop and scale described by {@link OutputGeometry}, and the colour
 * conversion itself.
 *
 * <p>The flip happens exactly once, on the output side. Source buffers and {@link OutputGeometry}
 * rectangles both use the GL convention - row 0 and y 0 are the bottom of the picture - so a
 * source row index needs no adjustment, while an output row does, because an encoded frame starts
 * at the top. Flipping on both sides cancels out and silently produces an upside-down video,
 * which is what the first on-device clips showed; OrientationTests now pins this down.
 *
 * <p>Each source row is pulled out of the direct buffer with one bulk copy and then indexed on the
 * heap. Reading a direct buffer a byte at a time costs several times more per pixel, which at
 * 720p is the difference between a few milliseconds and tens of milliseconds per frame.
 *
 * <p>Sampling is nearest-neighbour. When the GPU blit path is active the driver has already done
 * a filtered resample, so this only affects the software fallback.
 *
 * <p>Maths is fixed-point BT.601 full range, matching JPEG and JCodec's {@code YUV420J}.
 */
public final class ColorConvert {

    private ColorConvert() {
    }

    /**
     * Converts into three planes of 4:2:0 YUV using JCodec's signed bias, where a stored 0 means
     * the sample value 128.
     *
     * @param scratchRow reusable buffer of at least {@code sourceWidth * 4} bytes
     */
    public static void rgbaToYuv420(ByteBuffer source, int sourceWidth, int sourceHeight,
                                    OutputGeometry geometry, byte[] scratchRow,
                                    byte[] luma, byte[] chromaU, byte[] chromaV) {
        final int outWidth = geometry.outWidth;
        final int outHeight = geometry.outHeight;
        final int chromaWidth = outWidth >> 1;

        // Black in this representation: luma 0 - 128, chroma 128 - 128.
        java.util.Arrays.fill(luma, (byte) -128);
        java.util.Arrays.fill(chromaU, (byte) 0);
        java.util.Arrays.fill(chromaV, (byte) 0);

        final int dstX0 = geometry.dstX;
        final int dstY0 = geometry.dstY;
        final int dstW = geometry.dstWidth;
        final int dstH = geometry.dstHeight;
        final int srcX0 = geometry.srcX;
        final int srcY0 = geometry.srcY;
        final int srcW = geometry.srcWidth;
        final int srcH = geometry.srcHeight;
        final int rowBytes = Math.min(sourceWidth * 4, scratchRow.length);

        final long stepX = ((long) srcW << 16) / Math.max(1, dstW);
        final long stepY = ((long) srcH << 16) / Math.max(1, dstH);
        final boolean unscaled = srcW == dstW && srcH == dstH;

        for (int dy = 0; dy < dstH; dy++) {
            int sy = unscaled ? srcY0 + dy : srcY0 + (int) ((dy * stepY) >> 16);
            if (sy >= srcY0 + srcH) {
                sy = srcY0 + srcH - 1;
            }
            // The source buffer is already bottom-up, so sy indexes it directly.
            final int sourceRow = sy;
            if (sourceRow < 0 || sourceRow >= sourceHeight) {
                continue;
            }
            // The encoded frame starts at the top, so the destination row is flipped - once.
            final int outRow = outHeight - 1 - (dstY0 + dy);
            if (outRow < 0 || outRow >= outHeight) {
                continue;
            }

            source.position(sourceRow * sourceWidth * 4);
            source.get(scratchRow, 0, rowBytes);

            final int lumaRowBase = outRow * outWidth;
            final int chromaRowBase = (outRow >> 1) * chromaWidth;
            final boolean chromaRow = (outRow & 1) == 0;

            for (int dx = 0; dx < dstW; dx++) {
                int sx = unscaled ? srcX0 + dx : srcX0 + (int) ((dx * stepX) >> 16);
                if (sx >= srcX0 + srcW) {
                    sx = srcX0 + srcW - 1;
                }
                final int index = sx * 4;
                final int r = scratchRow[index] & 0xFF;
                final int g = scratchRow[index + 1] & 0xFF;
                final int b = scratchRow[index + 2] & 0xFF;

                final int outX = dstX0 + dx;
                final int y = (77 * r + 150 * g + 29 * b) >> 8;
                luma[lumaRowBase + outX] = (byte) (clamp8(y) - 128);

                // One chroma sample per 2x2 block, taken from the block's first pixel: the luma
                // plane carries the detail, so this is invisible at gameplay bitrates.
                if (chromaRow && (outX & 1) == 0) {
                    final int u = ((-43 * r - 85 * g + 128 * b) >> 8) + 128;
                    final int v = ((128 * r - 107 * g - 21 * b) >> 8) + 128;
                    final int chromaIndex = chromaRowBase + (outX >> 1);
                    chromaU[chromaIndex] = (byte) (clamp8(u) - 128);
                    chromaV[chromaIndex] = (byte) (clamp8(v) - 128);
                }
            }
        }
    }

    /**
     * Converts into a BGR byte raster, the layout {@code BufferedImage.TYPE_3BYTE_BGR} uses, so
     * the JRE's JPEG writer can compress it without a further copy.
     *
     * @param scratchRow reusable buffer of at least {@code sourceWidth * 4} bytes
     */
    public static void rgbaToBgr(ByteBuffer source, int sourceWidth, int sourceHeight,
                                 OutputGeometry geometry, byte[] scratchRow, byte[] bgr) {
        final int outWidth = geometry.outWidth;
        final int outHeight = geometry.outHeight;
        if (geometry.needsBackgroundFill()) {
            java.util.Arrays.fill(bgr, (byte) 0);
        }

        final int dstX0 = geometry.dstX;
        final int dstY0 = geometry.dstY;
        final int dstW = geometry.dstWidth;
        final int dstH = geometry.dstHeight;
        final int srcX0 = geometry.srcX;
        final int srcY0 = geometry.srcY;
        final int srcW = geometry.srcWidth;
        final int srcH = geometry.srcHeight;
        final int rowBytes = Math.min(sourceWidth * 4, scratchRow.length);

        final long stepX = ((long) srcW << 16) / Math.max(1, dstW);
        final long stepY = ((long) srcH << 16) / Math.max(1, dstH);
        final boolean unscaled = srcW == dstW && srcH == dstH;

        for (int dy = 0; dy < dstH; dy++) {
            int sy = unscaled ? srcY0 + dy : srcY0 + (int) ((dy * stepY) >> 16);
            if (sy >= srcY0 + srcH) {
                sy = srcY0 + srcH - 1;
            }
            // The source buffer is already bottom-up, so sy indexes it directly; only the
            // destination row is flipped, because an encoded frame starts at the top.
            final int sourceRow = sy;
            if (sourceRow < 0 || sourceRow >= sourceHeight) {
                continue;
            }
            final int outRow = outHeight - 1 - (dstY0 + dy);
            if (outRow < 0 || outRow >= outHeight) {
                continue;
            }

            source.position(sourceRow * sourceWidth * 4);
            source.get(scratchRow, 0, rowBytes);

            int out = (outRow * outWidth + dstX0) * 3;
            if (unscaled) {
                int index = srcX0 * 4;
                for (int dx = 0; dx < dstW; dx++) {
                    bgr[out] = scratchRow[index + 2];
                    bgr[out + 1] = scratchRow[index + 1];
                    bgr[out + 2] = scratchRow[index];
                    out += 3;
                    index += 4;
                }
            } else {
                for (int dx = 0; dx < dstW; dx++) {
                    int sx = srcX0 + (int) ((dx * stepX) >> 16);
                    if (sx >= srcX0 + srcW) {
                        sx = srcX0 + srcW - 1;
                    }
                    final int index = sx * 4;
                    bgr[out] = scratchRow[index + 2];
                    bgr[out + 1] = scratchRow[index + 1];
                    bgr[out + 2] = scratchRow[index];
                    out += 3;
                }
            }
        }
    }

    private static int clamp8(int value) {
        return value < 0 ? 0 : (value > 255 ? 255 : value);
    }
}
