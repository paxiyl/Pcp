package org.polyfrost.overflowanimations.config;

import java.lang.reflect.Field;
import java.lang.reflect.Method;

/**
 * One row in the settings GUI, bound to the field (or method) that backs it.
 */
public class ConfigOption {

    public enum Type {
        TOGGLE,
        DROPDOWN,
        SLIDER,
        BUTTON
    }

    public final Type type;
    public final String name;
    public final String description;
    public final String category;
    public final String subcategory;

    /** The field this option reads and writes, or {@code null} for a method-backed button. */
    public final Field field;
    /** The object the field belongs to, or {@code null} when the field is static. */
    public final Object owner;

    /** Dropdown entries. */
    public final String[] options;
    /** Slider bounds and increment ({@code 0} meaning continuous). */
    public final float min;
    public final float max;
    public final int step;
    /** Label drawn inside a button. */
    public final String buttonText;
    /** Method-backed button target, or {@code null}. */
    public final Method method;

    private ConfigOption(Type type, String name, String description, String category, String subcategory,
                         Field field, Object owner, String[] options, float min, float max, int step,
                         String buttonText, Method method) {
        this.type = type;
        this.name = name;
        this.description = description;
        this.category = category;
        this.subcategory = subcategory;
        this.field = field;
        this.owner = owner;
        this.options = options;
        this.min = min;
        this.max = max;
        this.step = step;
        this.buttonText = buttonText;
        this.method = method;
    }

    public static ConfigOption toggle(String name, String description, String category, String subcategory, Field field, Object owner) {
        return new ConfigOption(Type.TOGGLE, name, description, category, subcategory, field, owner, null, 0, 0, 0, null, null);
    }

    public static ConfigOption dropdown(String name, String description, String category, String subcategory, Field field, Object owner, String[] options) {
        return new ConfigOption(Type.DROPDOWN, name, description, category, subcategory, field, owner, options, 0, 0, 0, null, null);
    }

    public static ConfigOption slider(String name, String description, String category, String subcategory, Field field, Object owner, float min, float max, int step) {
        return new ConfigOption(Type.SLIDER, name, description, category, subcategory, field, owner, null, min, max, step, null, null);
    }

    public static ConfigOption runnableButton(String name, String description, String category, String subcategory, Field field, Object owner, String buttonText) {
        return new ConfigOption(Type.BUTTON, name, description, category, subcategory, field, owner, null, 0, 0, 0, buttonText, null);
    }

    public static ConfigOption methodButton(String name, String description, String category, String subcategory, Method method, Object owner, String buttonText) {
        return new ConfigOption(Type.BUTTON, name, description, category, subcategory, null, owner, null, 0, 0, 0, buttonText, method);
    }

    /** The name the backing field is saved under, or {@code null} for a method-backed button. */
    public String fieldName() {
        return field == null ? null : field.getName();
    }

    public boolean getBoolean() {
        try {
            return field.getBoolean(owner);
        } catch (Exception e) {
            return false;
        }
    }

    public void setBoolean(boolean value) {
        try {
            field.setBoolean(owner, value);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public int getInt() {
        try {
            return field.getInt(owner);
        } catch (Exception e) {
            return 0;
        }
    }

    public void setInt(int value) {
        try {
            field.setInt(owner, value);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public float getFloat() {
        try {
            return field.getFloat(owner);
        } catch (Exception e) {
            return 0f;
        }
    }

    public void setFloat(float value) {
        try {
            field.setFloat(owner, value);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void run() {
        try {
            if (method != null) {
                method.setAccessible(true);
                method.invoke(owner);
            } else {
                Object value = field.get(owner);
                if (value instanceof Runnable) {
                    ((Runnable) value).run();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
