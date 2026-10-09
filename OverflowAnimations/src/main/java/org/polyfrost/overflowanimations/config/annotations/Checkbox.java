package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * A boolean option rendered as a checkbox. Functionally identical to {@link Switch}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Checkbox {
    String name();

    String description() default "";

    String category() default "General";

    String subcategory() default "General";
}
