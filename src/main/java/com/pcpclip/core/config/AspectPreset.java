package com.pcpclip.core.config;

/** Output aspect ratios. The numerator/denominator pair is kept exact to avoid rounding drift. */
public enum AspectPreset {

    R16_9("16:9", 16, 9),
    R21_9("21:9 ultrawide", 21, 9),
    R32_9("32:9 super ultrawide", 32, 9),
    R4_3("4:3", 4, 3),
    R1_1("1:1 square", 1, 1),
    R9_16("9:16 vertical", 9, 16),
    MATCH_SCREEN("Match device screen", 0, 0),
    CUSTOM("Custom", 0, 0);

    private final String label;
    private final int numerator;
    private final int denominator;

    AspectPreset(String label, int numerator, int denominator) {
        this.label = label;
        this.numerator = numerator;
        this.denominator = denominator;
    }

    public String label() {
        return label;
    }

    public int numerator() {
        return numerator;
    }

    public int denominator() {
        return denominator;
    }

    /** True when the ratio comes from somewhere else (custom fields or the live framebuffer). */
    public boolean isDerived() {
        return numerator == 0 || denominator == 0;
    }

    public static AspectPreset byName(String name, AspectPreset fallback) {
        for (AspectPreset preset : values()) {
            if (preset.name().equalsIgnoreCase(name)) {
                return preset;
            }
        }
        return fallback;
    }
}
