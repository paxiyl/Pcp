package com.pcpclip.core.codec;

import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.EncoderPreference;

/** Everything an encoder backend needs to know, pulled out of the live config. */
public final class EncoderSpec {

    public final int width;
    public final int height;
    public final int targetFps;
    public final int bitrateKbps;
    public final int jpegQuality;
    public final int h264Qp;
    public final EncoderPreference preference;

    public EncoderSpec(int width, int height, int targetFps, int bitrateKbps,
                       int jpegQuality, int h264Qp, EncoderPreference preference) {
        this.width = width;
        this.height = height;
        this.targetFps = targetFps;
        this.bitrateKbps = bitrateKbps;
        this.jpegQuality = jpegQuality;
        this.h264Qp = h264Qp;
        this.preference = preference;
    }

    public static EncoderSpec from(ClipConfig config, int width, int height) {
        return new EncoderSpec(width, height, config.targetFps, config.bitrateKbps,
                config.jpegQuality, config.h264Qp, config.encoder);
    }

    public EncoderSpec withPreference(EncoderPreference other) {
        return new EncoderSpec(width, height, targetFps, bitrateKbps, jpegQuality, h264Qp, other);
    }

    /** Pixels per second the backend has to keep up with. */
    public long pixelRate() {
        return (long) width * height * Math.max(1, targetFps);
    }
}
