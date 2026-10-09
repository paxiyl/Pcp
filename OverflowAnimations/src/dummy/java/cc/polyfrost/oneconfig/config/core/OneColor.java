package cc.polyfrost.oneconfig.config.core;

/**
 * Compile-time stub for the DamageTint mod's colour field.
 *
 * <p>DamageTint stores its colour as a OneConfig {@code OneColor}, so the type has to exist to
 * compile {@code HitColorHook}. This lives in the {@code dummy} source set, which is on the
 * compile classpath only and is never packaged — and the code that touches it only runs when
 * DamageTint is actually installed, in which case the real class is present.
 */
public class OneColor {

    public int getRed() {
        return 0;
    }

    public int getGreen() {
        return 0;
    }

    public int getBlue() {
        return 0;
    }

    public int getAlpha() {
        return 0;
    }
}
