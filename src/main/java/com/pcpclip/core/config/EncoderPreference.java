package com.pcpclip.core.config;

/** Which encoder backend the user wants, subject to what the runtime actually offers. */
public enum EncoderPreference {

    /** Pick the backend that can sustain the selected resolution and frame rate. */
    AUTO("Automatic"),

    /** Pure-Java H.264 (JCodec) muxed into MP4. Small files, highest CPU cost. */
    H264_MP4("H.264 / MP4"),

    /** Motion JPEG in AVI, using the JRE's own JPEG encoder. Cheap CPU, large files. */
    MJPEG_AVI("Motion JPEG / AVI"),

    /** Platform hardware encoder, only if a bridge is actually reachable from the game JVM. */
    HARDWARE("Hardware (if available)");

    private final String label;

    EncoderPreference(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static EncoderPreference byName(String name, EncoderPreference fallback) {
        for (EncoderPreference preference : values()) {
            if (preference.name().equalsIgnoreCase(name)) {
                return preference;
            }
        }
        return fallback;
    }
}
