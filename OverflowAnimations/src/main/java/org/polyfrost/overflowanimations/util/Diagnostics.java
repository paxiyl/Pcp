package org.polyfrost.overflowanimations.util;

import org.polyfrost.overflowanimations.OverflowAnimations;
import org.polyfrost.overflowanimations.config.ItemPositionAdvancedSettings;
import org.polyfrost.overflowanimations.config.OldAnimationsSettings;

import java.io.File;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

/**
 * Self-check for {@code /oam debug}.
 *
 * <p>Reports where settings are stored, which Mixin is running, and — the useful part —
 * whether each mixin actually got applied. Mixin merges an {@code @Inject} handler into its
 * target class under its own name, so finding {@code overflowAnimations$...} declared on the
 * target proves the injection took; not finding it proves it did not.
 */
public class Diagnostics {

    /** {target class, injected handler, what it drives}. */
    private static final String[][] CHECKS = {
            {"net.minecraft.client.renderer.ItemRenderer", "overflowAnimations$itemTransform",
                    "item position / rotation / scale"},
            {"net.minecraft.client.renderer.ItemRenderer", "overflowAnimations$swingTransformations",
                    "item swing position"},
            {"net.minecraft.client.renderer.ItemRenderer", "overflowAnimations$blockedItemTransform",
                    "sword block position"},
            {"net.minecraft.client.renderer.ItemRenderer", "overflowAnimations$captureF1",
                    "1.7 first-person transforms"},
            {"net.minecraft.entity.EntityLivingBase", "overflowAnimations$modifySwingSpeed",
                    "item swing speed"},
            {"net.minecraft.client.renderer.entity.RenderEntityItem", "overflowAnimations$droppedItemTransforms",
                    "dropped item position"},
            {"net.minecraft.client.renderer.entity.RenderSnowball", "overflowAnimations$projectileTransforms",
                    "thrown projectile position"},
            {"net.minecraft.client.Minecraft", "overflowAnimations$blockHitAnimation",
                    "block-hitting animation"},
    };

    private Diagnostics() {
    }

    public static List<String> collect() {
        List<String> lines = new ArrayList<>();
        OldAnimationsSettings settings = OldAnimationsSettings.INSTANCE;
        ItemPositionAdvancedSettings advanced = OldAnimationsSettings.advancedSettings;

        lines.add("OverflowAnimations " + OverflowAnimations.VERSION + " (standalone, no OneConfig)");
        lines.add("Mixin runtime: " + mixinVersion());

        File config = settings.getConfigFile();
        lines.add("Settings file: " + config.getAbsolutePath());
        File dir = config.getParentFile();
        lines.add("  exists=" + config.isFile()
                + (config.isFile() ? " size=" + config.length() + "B" : "")
                + " folder writable=" + (dir != null && dir.canWrite()));

        lines.add("Master switches: Mod Enabled=" + settings.enabled
                + ", Global Toggle=" + OldAnimationsSettings.globalPositions);

        lines.add("Mixins applied:");
        for (String[] check : CHECKS) {
            lines.add("  " + (isApplied(check[0], check[1]) ? "OK   " : "FAIL ") + check[2]);
        }

        lines.add("Current values:");
        lines.add("  item pos X/Y/Z = " + settings.itemPositionX + " / " + settings.itemPositionY
                + " / " + settings.itemPositionZ);
        lines.add("  item scale = " + settings.itemScale
                + ", yaw/pitch/roll = " + settings.itemRotationYaw + " / " + settings.itemRotationPitch
                + " / " + settings.itemRotationRoll);
        lines.add("  swing speed = " + settings.itemSwingSpeed
                + ", haste = " + settings.itemSwingSpeedHaste
                + ", fatigue = " + settings.itemSwingSpeedFatigue
                + ", behaviour = " + settings.swingSetting);
        lines.add("  sword block pos = " + advanced.blockedPositionX + " / " + advanced.blockedPositionY
                + " / " + advanced.blockedPositionZ + ", scale = " + advanced.blockedScale);
        lines.add("  dropped item pos = " + advanced.droppedPositionX + " / " + advanced.droppedPositionY
                + " / " + advanced.droppedPositionZ + ", scale = " + advanced.droppedScale);
        return lines;
    }

    /** Prints the report to chat and to the game log, so either can be shared. */
    public static void report() {
        List<String> lines = collect();
        for (String line : lines) {
            System.out.println("[OverflowAnimations] " + line);
        }
        for (String line : lines) {
            Chat.sendRaw(line);
        }
    }

    private static boolean isApplied(String targetClass, String handler) {
        try {
            Class<?> target = Class.forName(targetClass, false, Diagnostics.class.getClassLoader());
            for (Method method : target.getDeclaredMethods()) {
                if (method.getName().equals(handler)) return true;
            }
            // Mixin may decorate a merged handler's name; a prefix match still identifies it.
            for (Method method : target.getDeclaredMethods()) {
                if (method.getName().contains(handler)) return true;
            }
            return false;
        } catch (Throwable t) {
            return false;
        }
    }

    private static String mixinVersion() {
        try {
            Class<?> bootstrap = Class.forName("org.spongepowered.asm.launch.MixinBootstrap");
            Field version = bootstrap.getField("VERSION");
            return String.valueOf(version.get(null));
        } catch (Throwable t) {
            return "unknown (" + t.getClass().getSimpleName() + ")";
        }
    }
}
