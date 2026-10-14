package net.minecraftforge.fml.common;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Compile-only stub of Forge's mod annotation. Only the attributes this mod sets are declared;
 * attribute values are recorded in the class file by name, so the real annotation supplies
 * everything else at runtime.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface Mod {

    String modid();

    String name() default "";

    String version() default "";

    boolean clientSideOnly() default false;

    String acceptedMinecraftVersions() default "";

    String dependencies() default "";

    String guiFactory() default "";

    boolean useMetadata() default false;

    /** Marks a lifecycle handler method. */
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.METHOD)
    @interface EventHandler {
    }

    /** Marks the field FML fills with the mod instance. */
    @Retention(RetentionPolicy.RUNTIME)
    @Target(ElementType.FIELD)
    @interface Instance {
        String value() default "";
    }
}
