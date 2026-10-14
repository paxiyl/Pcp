package com.pcpclip.core.codec;

import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.util.PcpLog;

/**
 * Builds encoders, applying the user's preference where the runtime allows it and falling back
 * with a logged reason where it does not.
 */
public final class EncoderFactory {

    private EncoderFactory() {
    }

    /**
     * Resolves {@link EncoderPreference#AUTO} and unavailable choices to something that exists.
     *
     * @param workers number of encoder worker threads, which decides whether software H.264 can
     *                keep up with the requested pixel rate
     */
    public static EncoderPreference resolve(EncoderSpec spec, int workers) {
        EncoderCapabilities capabilities = EncoderCapabilities.get();
        EncoderPreference wanted = spec.preference;

        if (wanted == EncoderPreference.AUTO) {
            return capabilities.autoChoice(spec.pixelRate(), workers);
        }
        if (capabilities.isAvailable(wanted)) {
            return wanted;
        }

        EncoderPreference fallback = capabilities.autoChoice(spec.pixelRate(), workers);
        PcpLog.warn(wanted.label() + " is not available here; using " + fallback.label()
                + " instead. Reason: " + firstUnavailableNote(wanted, capabilities));
        return fallback;
    }

    private static String firstUnavailableNote(EncoderPreference wanted, EncoderCapabilities caps) {
        String needle;
        switch (wanted) {
            case H264_MP4:
                needle = "H.264";
                break;
            case MJPEG_AVI:
                needle = "Motion JPEG";
                break;
            case HARDWARE:
                needle = "Hardware";
                break;
            default:
                return "no backend available";
        }
        for (String note : caps.notes()) {
            if (note.startsWith(needle)) {
                return note;
            }
        }
        return "no backend available";
    }

    /**
     * Creates an encoder for one segment.
     *
     * @param resolved the backend chosen by {@link #resolve}
     */
    public static VideoEncoder create(EncoderSpec spec, EncoderPreference resolved)
            throws EncoderUnavailableException {
        EncoderCapabilities capabilities = EncoderCapabilities.get();
        switch (resolved) {
            case HARDWARE: {
                HardwareEncoderProbe probe = HardwareEncoderProbe.get();
                if (!probe.available()) {
                    throw new EncoderUnavailableException("Hardware encoding is not available: "
                            + probe.detail());
                }
                return probe.bridge().create(spec);
            }
            case H264_MP4: {
                if (!capabilities.h264Available()) {
                    throw new EncoderUnavailableException(
                            "H.264 encoding needs JCodec, which is not on the classpath.");
                }
                try {
                    // Loading this class pulls in JCodec; guarded because the dependency is optional.
                    return new JcodecH264Encoder(spec);
                } catch (NoClassDefFoundError missing) {
                    throw new EncoderUnavailableException(
                            "JCodec is present but incomplete: " + missing.getMessage(), missing);
                } catch (RuntimeException error) {
                    throw new EncoderUnavailableException(
                            "JCodec could not start: " + error, error);
                }
            }
            case MJPEG_AVI:
                return new MjpegEncoder(spec);
            case AUTO:
            default:
                throw new EncoderUnavailableException(
                        "No video encoder is available in this runtime. " + capabilities.notes());
        }
    }
}
