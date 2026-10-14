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

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Locale;

/**
 * Measures the per-frame cost of each stage so the documented presets rest on numbers rather than
 * on hope, and so the automatic encoder choice can be calibrated.
 *
 * <p>What this cannot measure is the GL readback, which needs a real GL context and a real device;
 * docs/BENCHMARKS.md is explicit about which figures came from here and which need a phone.
 */
public final class BenchmarkMain {

    private static final int WARMUP_FRAMES = 15;
    private static final int MEASURED_FRAMES = 40;

    private BenchmarkMain() {
    }

    private static final int[][] PRESETS = {
            {854, 480, 30},
            {1280, 720, 30},
            {1280, 720, 60},
            {1920, 1080, 30},
            {1920, 1080, 60},
            {1920, 1080, 120},
            {2520, 1080, 30},
    };

    public static void main(String[] args) throws Exception {
        System.out.println("PcpClip encoder benchmark");
        System.out.println("java " + System.getProperty("java.version") + ", "
                + System.getProperty("os.arch") + ", "
                + Runtime.getRuntime().availableProcessors() + " cpus");
        System.out.println();
        System.out.println("| output | target | convert BGR | MJPEG q55 | MJPEG size | convert YUV | H.264 qp26 | H.264 size |");
        System.out.println("|---|---|---|---|---|---|---|---|");

        for (int[] preset : PRESETS) {
            int width = preset[0];
            int height = preset[1];
            int fps = preset[2];

            Stage convertBgr = measureConvert(width, height, false);
            Stage convertYuv = measureConvert(width, height, true);
            Stage mjpeg = measureEncoder(width, height, fps, EncoderPreference.MJPEG_AVI);
            Stage h264 = measureEncoder(width, height, fps, EncoderPreference.H264_MP4);

            System.out.println(String.format(Locale.ROOT,
                    "| %dx%d | %d fps | %.1f ms | %.1f ms (%.0f fps/thread) | %s | %.1f ms | %.1f ms (%.1f fps/thread) | %s |",
                    width, height, fps,
                    convertBgr.meanMillis,
                    mjpeg.meanMillis, 1000.0 / Math.max(0.001, mjpeg.meanMillis),
                    bytes(mjpeg.meanBytes),
                    convertYuv.meanMillis,
                    h264.meanMillis, 1000.0 / Math.max(0.001, h264.meanMillis),
                    bytes(h264.meanBytes)));
        }

        System.out.println();
        System.out.println("Sustained pixel rate per worker thread (pixels/second):");
        for (int[] preset : new int[][]{{1280, 720, 30}, {1920, 1080, 30}}) {
            Stage mjpeg = measureEncoder(preset[0], preset[1], preset[2], EncoderPreference.MJPEG_AVI);
            Stage h264 = measureEncoder(preset[0], preset[1], preset[2], EncoderPreference.H264_MP4);
            long pixels = (long) preset[0] * preset[1];
            System.out.println(String.format(Locale.ROOT,
                    "  %dx%d: Motion JPEG %.1f Mpx/s, H.264 %.1f Mpx/s",
                    preset[0], preset[1],
                    pixels / mjpeg.meanMillis / 1000.0,
                    pixels / h264.meanMillis / 1000.0));
        }

        System.out.println();
        System.out.println("Percentiles for the default preset (1280x720):");
        Stage detailed = measureEncoder(1280, 720, 30, EncoderPreference.MJPEG_AVI);
        System.out.println(String.format(Locale.ROOT,
                "  Motion JPEG: mean %.1f ms, median %.1f ms, p95 %.1f ms, max %.1f ms",
                detailed.meanMillis, detailed.medianMillis, detailed.p95Millis, detailed.maxMillis));
        Stage detailedH264 = measureEncoder(1280, 720, 30, EncoderPreference.H264_MP4);
        System.out.println(String.format(Locale.ROOT,
                "  H.264:       mean %.1f ms, median %.1f ms, p95 %.1f ms, max %.1f ms",
                detailedH264.meanMillis, detailedH264.medianMillis, detailedH264.p95Millis,
                detailedH264.maxMillis));
    }

    private static String bytes(double value) {
        if (value > 1024.0 * 1024.0) {
            return String.format(Locale.ROOT, "%.2f MB", value / (1024.0 * 1024.0));
        }
        return String.format(Locale.ROOT, "%.0f KB", value / 1024.0);
    }

    private static final class Stage {
        double meanMillis;
        double medianMillis;
        double p95Millis;
        double maxMillis;
        double meanBytes;
    }

    private static Stage measureConvert(int width, int height, boolean yuv) {
        OutputGeometry geometry = OutputGeometry.identity(width, height);
        ByteBuffer pixels = ByteBuffer.allocateDirect(width * height * 4);
        TestSupport.fillFrame(pixels, width, height, 1);
        byte[] scratch = new byte[width * 4];
        byte[] luma = new byte[width * height];
        byte[] chromaU = new byte[(width / 2) * (height / 2)];
        byte[] chromaV = new byte[(width / 2) * (height / 2)];
        byte[] bgr = new byte[width * height * 3];

        double[] samples = new double[MEASURED_FRAMES];
        for (int i = 0; i < WARMUP_FRAMES + MEASURED_FRAMES; i++) {
            long started = System.nanoTime();
            if (yuv) {
                ColorConvert.rgbaToYuv420(pixels, width, height, geometry, scratch, luma, chromaU, chromaV);
            } else {
                ColorConvert.rgbaToBgr(pixels, width, height, geometry, scratch, bgr);
            }
            long cost = System.nanoTime() - started;
            if (i >= WARMUP_FRAMES) {
                samples[i - WARMUP_FRAMES] = cost / 1_000_000.0;
            }
        }
        return summarise(samples, 0.0);
    }

    private static Stage measureEncoder(int width, int height, int fps, EncoderPreference backend)
            throws Exception {
        EncoderSpec spec = new EncoderSpec(width, height, fps, 4000, 55, 26, backend);
        VideoEncoder encoder = EncoderFactory.create(spec, backend);
        OutputGeometry geometry = OutputGeometry.compute(width, height, width, height, FitMode.CROP);
        FramePool pool = new FramePool(width * height * 4, 64L * 1024L * 1024L);
        final long[] totalBytes = {0L};
        PacketSink sink = new PacketSink() {
            @Override
            public void packet(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
                    throws IOException {
                totalBytes[0] += length;
            }
        };

        double[] samples = new double[MEASURED_FRAMES];
        long measuredBytes = 0L;
        for (int i = 0; i < WARMUP_FRAMES + MEASURED_FRAMES; i++) {
            VideoFrame frame = pool.acquire(width, height, geometry, i * (1_000_000_000L / fps), i);
            if (frame == null) {
                throw new IllegalStateException("pool exhausted in a single-threaded benchmark");
            }
            TestSupport.fillFrame(frame.pixels(), width, height, i);
            long before = totalBytes[0];
            long started = System.nanoTime();
            encoder.encode(frame, sink);
            long cost = System.nanoTime() - started;
            frame.release();
            if (i >= WARMUP_FRAMES) {
                samples[i - WARMUP_FRAMES] = cost / 1_000_000.0;
                measuredBytes += totalBytes[0] - before;
            }
        }
        encoder.close();
        pool.close();
        return summarise(samples, measuredBytes / (double) MEASURED_FRAMES);
    }

    private static Stage summarise(double[] samples, double meanBytes) {
        double[] sorted = samples.clone();
        Arrays.sort(sorted);
        double sum = 0.0;
        for (double sample : samples) {
            sum += sample;
        }
        Stage stage = new Stage();
        stage.meanMillis = sum / samples.length;
        stage.medianMillis = sorted[sorted.length / 2];
        stage.p95Millis = sorted[(int) (sorted.length * 0.95)];
        stage.maxMillis = sorted[sorted.length - 1];
        stage.meanBytes = meanBytes;
        return stage;
    }
}
