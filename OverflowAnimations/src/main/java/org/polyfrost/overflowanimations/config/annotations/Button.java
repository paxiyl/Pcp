package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * An action, backed either by a {@link Runnable} field or by a no-argument method.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.FIELD, ElementType.METHOD})
public @interface Button {
    String name();

    String text();

    String description() default "";

    String category() default "General";

    String subcategory() default "General";
}
