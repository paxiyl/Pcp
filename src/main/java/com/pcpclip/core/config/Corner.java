package com.pcpclip.core.config;

/** Screen corner for the recording indicator. */
public enum Corner {

    TOP_LEFT("Top left"),
    TOP_RIGHT("Top right"),
    BOTTOM_LEFT("Bottom left"),
    BOTTOM_RIGHT("Bottom right");

    private final String label;

    Corner(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static Corner byName(String name, Corner fallback) {
        for (Corner corner : values()) {
            if (corner.name().equalsIgnoreCase(name)) {
                return corner;
            }
        }
        return fallback;
    }
}
