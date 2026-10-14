package com.pcpclip.core.codec;

import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.util.PcpLog;

import javax.imageio.ImageIO;
import java.util.ArrayList;
import java.util.List;

/**
 * What this runtime can actually encode, probed once and reported honestly.
 *
 * <p>The pixel-rate ceiling for software H.264 is deliberately conservative. It was measured on a
 * desktop x86 core and then divided down for phone-class hardware (see docs/BENCHMARKS.md); the
 * point is that automatic selection should never hand a device a target it cannot sustain, while
 * still letting the user force H.264 if they want it.
 */
public final class EncoderCapabilities {

    /**
     * Pixels per second one worker thread is assumed to sustain on a phone.
     *
     * <p>Measured on a desktop-class x86 core (see docs/BENCHMARKS.md): 35 Mpx/s for Motion JPEG
     * and 13 Mpx/s for JCodec's H.264. Both figures are then cut roughly in half, because scalar
     * Java on a phone's big core is slower and because a phone throttles once it warms up. The
     * point of these constants is only to stop the automatic choice handing a device a target it
     * cannot hold; the performance saver handles the rest at runtime from real measurements.
     */
    public static final long H264_PIXELS_PER_SECOND_PER_WORKER = 7_000_000L;
    public static final long MJPEG_PIXELS_PER_SECOND_PER_WORKER = 18_000_000L;

    private static volatile EncoderCapabilities instance;

    private final boolean jpegAvailable;
    private final boolean h264Available;
    private final boolean hardwareAvailable;
    private final List<String> notes;

    private EncoderCapabilities(boolean jpegAvailable, boolean h264Available,
                                boolean hardwareAvailable, List<String> notes) {
        this.jpegAvailable = jpegAvailable;
        this.h264Available = h264Available;
        this.hardwareAvailable = hardwareAvailable;
        this.notes = notes;
    }

    public static EncoderCapabilities get() {
        EncoderCapabilities local = instance;
        if (local == null) {
            synchronized (EncoderCapabilities.class) {
                local = instance;
                if (local == null) {
                    local = probe();
                    instance = local;
                }
            }
        }
        return local;
    }

    private static EncoderCapabilities probe() {
        List<String> notes = new ArrayList<String>();

        boolean jpeg;
        try {
            jpeg = ImageIO.getImageWritersByFormatName("jpeg").hasNext();
        } catch (Throwable error) {
            jpeg = false;
            notes.add("ImageIO failed to start: " + error);
        }
        notes.add(jpeg ? "Motion JPEG: available (JRE JPEG writer)"
                : "Motion JPEG: UNAVAILABLE - this JRE has no JPEG writer");

        boolean h264;
        try {
            Class.forName("org.jcodec.codecs.h264.H264Encoder", false,
                    EncoderCapabilities.class.getClassLoader());
            Class.forName("org.jcodec.codecs.h264.encode.H264FixedRateControl", false,
                    EncoderCapabilities.class.getClassLoader());
            h264 = true;
        } catch (Throwable missing) {
            h264 = false;
        }
        notes.add(h264 ? "H.264/MP4: available (JCodec, software)"
                : "H.264/MP4: UNAVAILABLE - JCodec classes are not on the classpath");

        HardwareEncoderProbe hardware = HardwareEncoderProbe.get();
        notes.add("Hardware: " + (hardware.available() ? "available - " : "unavailable - ")
                + hardware.detail());

        EncoderCapabilities capabilities =
                new EncoderCapabilities(jpeg, h264, hardware.available(), notes);
        for (String note : notes) {
            PcpLog.info("encoder probe | " + note);
        }
        return capabilities;
    }

    public boolean jpegAvailable() {
        return jpegAvailable;
    }

    public boolean h264Available() {
        return h264Available;
    }

    public boolean hardwareAvailable() {
        return hardwareAvailable;
    }

    public boolean anyAvailable() {
        return jpegAvailable || h264Available || hardwareAvailable;
    }

    public List<String> notes() {
        return new ArrayList<String>(notes);
    }

    public boolean isAvailable(EncoderPreference preference) {
        switch (preference) {
            case H264_MP4:
                return h264Available;
            case MJPEG_AVI:
                return jpegAvailable;
            case HARDWARE:
                return hardwareAvailable;
            case AUTO:
            default:
                return anyAvailable();
        }
    }

    /**
     * Whether software H.264 can plausibly keep up, given how many worker threads are available.
     * Used by {@link EncoderPreference#AUTO} and by the warnings shown next to the preset list.
     */
    public boolean softwareH264CanSustain(long pixelRate, int workers) {
        return pixelRate <= H264_PIXELS_PER_SECOND_PER_WORKER * Math.max(1, workers);
    }

    public boolean mjpegCanSustain(long pixelRate, int workers) {
        return pixelRate <= MJPEG_PIXELS_PER_SECOND_PER_WORKER * Math.max(1, workers);
    }

    /**
     * The backend {@link EncoderPreference#AUTO} would choose for this workload.
     *
     * <p>H.264 in MP4 is preferred whenever it can be sustained, because MP4 is the container
     * Android galleries and chat apps accept; Motion JPEG is the cheaper fallback for pixel rates
     * software H.264 cannot hold.
     */
    public EncoderPreference autoChoice(long pixelRate, int workers) {
        if (hardwareAvailable) {
            return EncoderPreference.HARDWARE;
        }
        if (h264Available && softwareH264CanSustain(pixelRate, workers)) {
            return EncoderPreference.H264_MP4;
        }
        if (jpegAvailable) {
            return EncoderPreference.MJPEG_AVI;
        }
        return h264Available ? EncoderPreference.H264_MP4 : EncoderPreference.AUTO;
    }

    /**
     * Plain-language verdict on a preset, for display next to the resolution and frame-rate
     * choices. The estimate is deliberately pessimistic; the status display shows what is really
     * happening once recording starts.
     */
    public String sustainabilityNote(EncoderPreference backend, long pixelRate, int workers) {
        long perWorker = backend == EncoderPreference.MJPEG_AVI
                ? MJPEG_PIXELS_PER_SECOND_PER_WORKER : H264_PIXELS_PER_SECOND_PER_WORKER;
        if (backend == EncoderPreference.HARDWARE) {
            return "Hardware encoder: cost depends on the device.";
        }
        double neededWorkers = pixelRate / (double) perWorker;
        if (neededWorkers <= workers * 0.7) {
            return "Should keep up comfortably on this device.";
        }
        if (neededWorkers <= workers) {
            return "Close to the limit; expect occasional dropped frames.";
        }
        return String.format(java.util.Locale.ROOT,
                "Likely too demanding: needs about %.1f encoder threads, %d available. Frames will "
                        + "be dropped - lower the resolution or frame rate, or use Motion JPEG.",
                neededWorkers, workers);
    }
}
