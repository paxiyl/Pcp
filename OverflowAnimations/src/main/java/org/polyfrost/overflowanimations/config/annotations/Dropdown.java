package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An int option constrained to the indices of {@link #options()}.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Dropdown {
    String name();

    String description() default "";

    String[] options();

    String category() default "General";

    String subcategory() default "General";
}
