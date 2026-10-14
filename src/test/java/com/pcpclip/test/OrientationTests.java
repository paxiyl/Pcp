package com.pcpclip.test;

import com.pcpclip.core.codec.ColorConvert;
import com.pcpclip.core.codec.EncoderFactory;
import com.pcpclip.core.codec.EncoderSpec;
import com.pcpclip.core.codec.PacketSink;
import com.pcpclip.core.codec.VideoEncoder;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.config.FitMode;
import com.pcpclip.core.frame.FramePool;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/**
 * Which way up a captured frame comes out, and which way round.
 *
 * <p>These exist because the first on-device clips came out upside down while every other test
 * passed: the conversion step applied the GL-to-image flip twice, and nothing checked. Feeding
 * synthetic frames through the pipeline and reading them back out again proves the pipeline is
 * self-consistent, which is not the same as proving it is the right way up - so each check here
 * puts a known mark in a known corner of the *source* and insists on finding it in the right
 * corner of the *decoded output*.
 *
 * <p>Source buffers follow the GL convention the capture layer really delivers: row 0 of the
 * buffer is the bottom of the picture.
 */
final class OrientationTests {

    private OrientationTests() {
    }

    private static final int RED = 0xFFFF0000;
    private static final int GREEN = 0xFF00FF00;
    private static final int BLUE = 0xFF0000FF;
    private static final int WHITE = 0xFFFFFFFF;

    static void run() throws IOException {
        conversionToBgr();
        conversionToYuv();
        motionJpegEndToEnd();
        croppedFrameKeepsOrientation();
        letterboxedFrameKeepsOrientation();
        h264EndToEnd();
    }

    /**
     * Paints a buffer in GL order: bottom-left red, bottom-right green, top-left blue,
     * top-right white. Buffer row 0 is the bottom of the picture.
     */
    private static ByteBuffer paintCorners(int width, int height) {
        ByteBuffer buffer = ByteBuffer.allocateDirect(width * height * 4);
        for (int row = 0; row < height; row++) {           // row 0 = bottom
            boolean bottom = row < height / 2;
            for (int x = 0; x < width; x++) {
                boolean left = x < width / 2;
                int colour = bottom ? (left ? RED : GREEN) : (left ? BLUE : WHITE);
                buffer.put((byte) ((colour >> 16) & 0xFF));
                buffer.put((byte) ((colour >> 8) & 0xFF));
                buffer.put((byte) (colour & 0xFF));
                buffer.put((byte) 255);
            }
        }
        buffer.flip();
        return buffer;
    }

    private static String name(int rgb) {
        int r = (rgb >> 16) & 0xFF;
        int g = (rgb >> 8) & 0xFF;
        int b = rgb & 0xFF;
        if (r > 180 && g > 180 && b > 180) {
            return "white";
        }
        if (r > 150 && g < 100 && b < 100) {
            return "red";
        }
        if (g > 150 && r < 100 && b < 100) {
            return "green";
        }
        if (b > 150 && r < 100 && g < 100) {
            return "blue";
        }
        if (r < 60 && g < 60 && b < 60) {
            return "black";
        }
        return "other(" + r + "," + g + "," + b + ")";
    }

    private static void conversionToBgr() {
        startTest("orientation: RGBA to BGR puts the bottom of the frame at the bottom");
        int width = 64;
        int height = 32;
        ByteBuffer source = paintCorners(width, height);
        OutputGeometry geometry = OutputGeometry.identity(width, height);
        byte[] bgr = new byte[width * height * 3];
        ColorConvert.rgbaToBgr(source, width, height, geometry, new byte[width * 4], bgr);

        // Output row 0 is the top of the picture.
        check("blue".equals(bgrAt(bgr, width, 2, 2)), "top-left is blue, got " + bgrAt(bgr, width, 2, 2));
        check("white".equals(bgrAt(bgr, width, width - 3, 2)),
                "top-right is white, got " + bgrAt(bgr, width, width - 3, 2));
        check("red".equals(bgrAt(bgr, width, 2, height - 3)),
                "bottom-left is red, got " + bgrAt(bgr, width, 2, height - 3));
        check("green".equals(bgrAt(bgr, width, width - 3, height - 3)),
                "bottom-right is green, got " + bgrAt(bgr, width, width - 3, height - 3));
    }

    private static String bgrAt(byte[] bgr, int width, int x, int y) {
        int index = (y * width + x) * 3;
        int b = bgr[index] & 0xFF;
        int g = bgr[index + 1] & 0xFF;
        int r = bgr[index + 2] & 0xFF;
        return name((r << 16) | (g << 8) | b);
    }

    private static void conversionToYuv() {
        startTest("orientation: RGBA to YUV puts the bottom of the frame at the bottom");
        int width = 64;
        int height = 32;
        // White at the top of the picture, black at the bottom: luma alone shows the orientation.
        ByteBuffer source = ByteBuffer.allocateDirect(width * height * 4);
        for (int row = 0; row < height; row++) {
            int value = row < height / 2 ? 0 : 255;         // row 0 = bottom = black
            for (int x = 0; x < width; x++) {
                source.put((byte) value).put((byte) value).put((byte) value).put((byte) 255);
            }
        }
        source.flip();

        OutputGeometry geometry = OutputGeometry.identity(width, height);
        byte[] luma = new byte[width * height];
        byte[] chromaU = new byte[(width / 2) * (height / 2)];
        byte[] chromaV = new byte[(width / 2) * (height / 2)];
        ColorConvert.rgbaToYuv420(source, width, height, geometry, new byte[width * 4],
                luma, chromaU, chromaV);

        // JCodec stores luma biased by -128, so white is +127 and black is -128.
        int top = luma[2 * width + 2];
        int bottom = luma[(height - 3) * width + 2];
        note("top luma " + top + ", bottom luma " + bottom);
        check(top > 0, "top of the picture is the bright half (got " + top + ")");
        check(bottom < 0, "bottom of the picture is the dark half (got " + bottom + ")");
    }

    private static void motionJpegEndToEnd() throws IOException {
        startTest("orientation: a Motion JPEG frame decodes the right way up");
        int width = 64;
        int height = 32;
        BufferedImage decoded = encodeOneJpegFrame(width, height,
                OutputGeometry.identity(width, height), paintCorners(width, height), width, height);
        check(decoded != null, "the frame decoded");
        if (decoded == null) {
            return;
        }
        check("blue".equals(name(decoded.getRGB(2, 2))),
                "top-left is blue, got " + name(decoded.getRGB(2, 2)));
        check("white".equals(name(decoded.getRGB(width - 3, 2))),
                "top-right is white, got " + name(decoded.getRGB(width - 3, 2)));
        check("red".equals(name(decoded.getRGB(2, height - 3))),
                "bottom-left is red, got " + name(decoded.getRGB(2, height - 3)));
        check("green".equals(name(decoded.getRGB(width - 3, height - 3))),
                "bottom-right is green, got " + name(decoded.getRGB(width - 3, height - 3)));
    }

    private static void croppedFrameKeepsOrientation() throws IOException {
        startTest("orientation: cropping to ultrawide keeps the picture the right way up");
        int sourceWidth = 64;
        int sourceHeight = 64;
        // 64x64 source cropped to a 64x28 (roughly 21:9) output: trims top and bottom.
        OutputGeometry geometry = OutputGeometry.compute(sourceWidth, sourceHeight, 64, 28,
                FitMode.CROP);
        note("geometry: " + geometry);
        BufferedImage decoded = encodeOneJpegFrame(geometry.outWidth, geometry.outHeight, geometry,
                paintCorners(sourceWidth, sourceHeight), sourceWidth, sourceHeight);
        check(decoded != null, "the frame decoded");
        if (decoded == null) {
            return;
        }
        check("blue".equals(name(decoded.getRGB(2, 2))),
                "cropped top-left still blue, got " + name(decoded.getRGB(2, 2)));
        check("red".equals(name(decoded.getRGB(2, geometry.outHeight - 3))),
                "cropped bottom-left still red, got "
                        + name(decoded.getRGB(2, geometry.outHeight - 3)));
    }

    private static void letterboxedFrameKeepsOrientation() throws IOException {
        startTest("orientation: letterboxing keeps the picture the right way up between the bars");
        int sourceWidth = 64;
        int sourceHeight = 32;
        OutputGeometry geometry = OutputGeometry.compute(sourceWidth, sourceHeight, 64, 64,
                FitMode.LETTERBOX);
        note("geometry: " + geometry);
        BufferedImage decoded = encodeOneJpegFrame(geometry.outWidth, geometry.outHeight, geometry,
                paintCorners(sourceWidth, sourceHeight), sourceWidth, sourceHeight);
        check(decoded != null, "the frame decoded");
        if (decoded == null) {
            return;
        }
        check("black".equals(name(decoded.getRGB(32, 2))),
                "top bar is black, got " + name(decoded.getRGB(32, 2)));
        check("black".equals(name(decoded.getRGB(32, geometry.outHeight - 3))),
                "bottom bar is black, got " + name(decoded.getRGB(32, geometry.outHeight - 3)));
        int pictureTop = geometry.outHeight - (geometry.dstY + geometry.dstHeight) + 3;
        int pictureBottom = geometry.outHeight - geometry.dstY - 3;
        check("blue".equals(name(decoded.getRGB(2, pictureTop))),
                "picture top-left is blue, got " + name(decoded.getRGB(2, pictureTop)));
        check("red".equals(name(decoded.getRGB(2, pictureBottom))),
                "picture bottom-left is red, got " + name(decoded.getRGB(2, pictureBottom)));
    }

    /** Runs one frame through the real encoder and decodes the JPEG it produced. */
    private static BufferedImage encodeOneJpegFrame(int outWidth, int outHeight,
                                                    OutputGeometry geometry, ByteBuffer pixels,
                                                    int sourceWidth, int sourceHeight)
            throws IOException {
        EncoderSpec spec = new EncoderSpec(outWidth, outHeight, 30, 4000, 90, 20,
                EncoderPreference.MJPEG_AVI);
        VideoEncoder encoder;
        try {
            encoder = EncoderFactory.create(spec, EncoderPreference.MJPEG_AVI);
        } catch (Exception unavailable) {
            note("Motion JPEG unavailable: " + unavailable);
            return null;
        }
        FramePool pool = new FramePool(sourceWidth * sourceHeight * 4, 8L * 1024L * 1024L);
        VideoFrame frame = pool.acquire(sourceWidth, sourceHeight, geometry, 0L, 0L);
        if (frame == null) {
            return null;
        }
        frame.pixels().clear();
        pixels.rewind();
        frame.pixels().put(pixels);
        frame.pixels().flip();

        final ByteArrayOutputStream captured = new ByteArrayOutputStream();
        encoder.encode(frame, new PacketSink() {
            @Override
            public void packet(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
                    throws IOException {
                captured.write(data, offset, length);
            }
        });
        frame.release();
        encoder.close();
        pool.close();
        return ImageIO.read(new ByteArrayInputStream(captured.toByteArray()));
    }

    /** The H.264 path has its own conversion, so it gets its own end-to-end check. */
    private static void h264EndToEnd() throws IOException {
        startTest("orientation: an H.264 clip decodes the right way up");
        if (!Ffprobe.available()) {
            note("ffmpeg not available; skipping");
            return;
        }
        File directory = TestSupport.tempDirectory("pcpclip-orientation");
        try {
            int width = 64;
            int height = 64;
            File clip = new File(directory, "orientation.mp4");
            ClipBuilder.writeSingleColourQuadrants(clip, width, height, paintCorners(width, height));

            File png = new File(directory, "frame.png");
            if (!Ffprobe.extractFirstFrame(clip, png)) {
                note("could not extract a frame; skipping");
                return;
            }
            BufferedImage decoded = ImageIO.read(png);
            check(decoded != null, "the extracted frame loaded");
            if (decoded == null) {
                return;
            }
            check("blue".equals(name(decoded.getRGB(6, 6))),
                    "top-left is blue, got " + name(decoded.getRGB(6, 6)));
            check("white".equals(name(decoded.getRGB(width - 7, 6))),
                    "top-right is white, got " + name(decoded.getRGB(width - 7, 6)));
            check("red".equals(name(decoded.getRGB(6, height - 7))),
                    "bottom-left is red, got " + name(decoded.getRGB(6, height - 7)));
            check("green".equals(name(decoded.getRGB(width - 7, height - 7))),
                    "bottom-right is green, got " + name(decoded.getRGB(width - 7, height - 7)));
        } finally {
            TestSupport.deleteTree(directory);
        }
    }
}
