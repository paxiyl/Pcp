package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Records the name an option had in Sk1er's Old Animations. Retained purely as
 * documentation now that the Vigilance migrator is gone.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface VigilanceName {
    String name();

    String category() default "";

    String subcategory() default "";
}
