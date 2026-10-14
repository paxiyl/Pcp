package com.pcpclip.core.config;

/**
 * How the rendered frame is mapped into an output frame of a different shape.
 *
 * <p>Both supported modes scale the source uniformly, so the world, the HUD, the crosshair and
 * every GUI element keep their proportions. Nothing is ever squashed to fit.
 */
public enum FitMode {

    /** Keep the output completely filled by cropping the long edge of the source. */
    CROP("Crop to fill"),

    /** Keep the whole source visible and pad the output with black bars. */
    LETTERBOX("Fit with bars"),

    /**
     * Render the game into a custom viewport of the target shape.
     *
     * <p>Not enabled on PojavLauncher: resizing the game's own framebuffer mid-frame breaks
     * OptiFine and the GL4ES renderer. Selecting it falls back to {@link #LETTERBOX} and the UI
     * says so, rather than risking a broken render path. See docs/COMPATIBILITY.md.
     */
    VIEWPORT("Custom viewport (unavailable)");

    private final String label;

    FitMode(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Maps unavailable modes onto the safe capture-and-crop path. */
    public FitMode resolveSupported() {
        return this == VIEWPORT ? LETTERBOX : this;
    }

    public boolean isSupported() {
        return this != VIEWPORT;
    }

    public static FitMode byName(String name, FitMode fallback) {
        for (FitMode mode : values()) {
            if (mode.name().equalsIgnoreCase(name)) {
                return mode;
            }
        }
        return fallback;
    }
}
