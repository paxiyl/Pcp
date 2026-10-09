package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A float option constrained to [{@link #min()}, {@link #max()}].
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Slider {
    String name();

    String description() default "";

    float min();

    float max();

    /** Increment to snap to, or 0 for a continuous slider. */
    int step() default 0;

    String category() default "General";

    String subcategory() default "General";

    /** Kept for source compatibility; every slider in this mod applies instantly. */
    boolean instant() default false;
}
