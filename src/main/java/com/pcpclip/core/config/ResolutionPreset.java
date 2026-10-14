package com.pcpclip.core.config;

/**
 * Output height classes. Width is derived from the chosen {@link AspectPreset} so that changing
 * the aspect ratio never stretches the picture - it only changes how much of the frame is kept.
 */
public enum ResolutionPreset {

    P360("360p", 360),
    P480("480p", 480),
    P720("720p", 720),
    P1080("1080p", 1080),
    CUSTOM("Custom", 0);

    private final String label;
    private final int height;

    ResolutionPreset(String label, int height) {
        this.label = label;
        this.height = height;
    }

    public String label() {
        return label;
    }

    /** Output height in pixels, or 0 for {@link #CUSTOM} where the user supplies both axes. */
    public int height() {
        return height;
    }

    public static ResolutionPreset byName(String name, ResolutionPreset fallback) {
        for (ResolutionPreset preset : values()) {
            if (preset.name().equalsIgnoreCase(name)) {
                return preset;
            }
        }
        return fallback;
    }
}
