package org.polyfrost.overflowanimations.config.annotations;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a field holding a nested options holder. Its options are collected into the
 * categories/subcategories they declare themselves, and its values are saved as a
 * nested object under the field's name.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Page {
    String name();

    String description() default "";

    PageLocation location() default PageLocation.BOTTOM;

    String category() default "General";

    String subcategory() default "General";
}
