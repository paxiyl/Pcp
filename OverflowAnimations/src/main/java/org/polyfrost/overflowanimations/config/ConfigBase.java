package org.polyfrost.overflowanimations.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonPrimitive;
import org.polyfrost.overflowanimations.config.annotations.Button;
import org.polyfrost.overflowanimations.config.annotations.Checkbox;
import org.polyfrost.overflowanimations.config.annotations.Dropdown;
import org.polyfrost.overflowanimations.config.annotations.Exclude;
import org.polyfrost.overflowanimations.config.annotations.Page;
import org.polyfrost.overflowanimations.config.annotations.Slider;
import org.polyfrost.overflowanimations.config.annotations.Switch;
import org.polyfrost.overflowanimations.gui.OverflowSettingsGui;
import org.polyfrost.overflowanimations.util.GuiQueue;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A self-contained stand-in for OneConfig's {@code Config}.
 *
 * <p>Options are described by the annotations in {@code config.annotations}, read back out by
 * reflection, saved as JSON next to the other mod configs, and drawn by {@link OverflowSettingsGui}
 * using nothing but vanilla Minecraft calls. That keeps the mod free of OneConfig — and of the
 * NanoVG/LWJGL surface OneConfig needs, which is what breaks it under PojavLauncher.
 */
public class ConfigBase {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    /** Master toggle for the whole mod, checked by every mixin. */
    @Switch(
            name = "Mod Enabled",
            description = "Turns every OverflowAnimations feature on or off at once. "
                    + "This is the toggle OneConfig showed next to the mod in its mods list.",
            category = "General",
            subcategory = "General"
    )
    public boolean enabled = true;

    private transient String displayName;
    private transient File configFile;
    private transient final List<ConfigOption> options = new ArrayList<>();
    private transient final List<String> categories = new ArrayList<>();
    private transient final Map<String, List<Runnable>> listeners = new HashMap<>();
    private transient final Map<String, List<String>> dependencies = new HashMap<>();
    /** Field name -> (owner, field) for everything that gets saved, in declaration order. */
    private transient final Map<String, Object[]> saved = new LinkedHashMap<>();
    /** Nested holders declared with {@link Page}, saved as sub-objects. */
    private transient final Map<String, Object> pages = new LinkedHashMap<>();
    private transient boolean initialized = false;

    protected ConfigBase(String displayName, String fileName) {
        this.displayName = displayName;
        this.configFile = new File(configDirectory(), fileName);
    }

    private static File configDirectory() {
        File dir = new File("config");
        if (!dir.exists() && !dir.mkdirs()) {
            System.out.println("[OverflowAnimations] Could not create the config directory, settings will not persist.");
        }
        return dir;
    }

    // ------------------------------------------------------------------ setup

    /**
     * Collects every option, then loads saved values over the defaults. Call from the
     * subclass constructor, as OneConfig's {@code initialize()} was called.
     */
    protected void initialize() {
        if (initialized) return;
        initialized = true;
        collect(getClass(), this);
        load();
    }

    private void collect(Class<?> clazz, Object instance) {
        // Walk the hierarchy top-down so `enabled` is registered before the subclass's own fields.
        List<Class<?>> hierarchy = new ArrayList<>();
        for (Class<?> c = clazz; c != null && c != Object.class; c = c.getSuperclass()) {
            hierarchy.add(0, c);
        }
        for (Class<?> c : hierarchy) {
            collectDeclared(c, instance);
        }
    }

    private void collectDeclared(Class<?> clazz, Object instance) {
        for (Field field : clazz.getDeclaredFields()) {
            if (field.isSynthetic() || field.isAnnotationPresent(Exclude.class) || Modifier.isTransient(field.getModifiers())) {
                continue;
            }
            field.setAccessible(true);
            Object owner = Modifier.isStatic(field.getModifiers()) ? null : instance;

            Page page = field.getAnnotation(Page.class);
            if (page != null) {
                Object nested;
                try {
                    nested = field.get(owner);
                } catch (Exception e) {
                    e.printStackTrace();
                    continue;
                }
                if (nested == null) continue;
                pages.put(field.getName(), nested);
                collectDeclared(nested.getClass(), nested);
                continue;
            }

            Switch toggle = field.getAnnotation(Switch.class);
            if (toggle != null) {
                addOption(ConfigOption.toggle(toggle.name(), toggle.description(), toggle.category(), toggle.subcategory(), field, owner));
                saved.put(field.getName(), new Object[]{owner, field});
                continue;
            }
            Checkbox checkbox = field.getAnnotation(Checkbox.class);
            if (checkbox != null) {
                addOption(ConfigOption.toggle(checkbox.name(), checkbox.description(), checkbox.category(), checkbox.subcategory(), field, owner));
                saved.put(field.getName(), new Object[]{owner, field});
                continue;
            }
            Dropdown dropdown = field.getAnnotation(Dropdown.class);
            if (dropdown != null) {
                addOption(ConfigOption.dropdown(dropdown.name(), dropdown.description(), dropdown.category(), dropdown.subcategory(), field, owner, dropdown.options()));
                saved.put(field.getName(), new Object[]{owner, field});
                continue;
            }
            Slider slider = field.getAnnotation(Slider.class);
            if (slider != null) {
                addOption(ConfigOption.slider(slider.name(), slider.description(), slider.category(), slider.subcategory(), field, owner, slider.min(), slider.max(), slider.step()));
                saved.put(field.getName(), new Object[]{owner, field});
                continue;
            }
            Button button = field.getAnnotation(Button.class);
            if (button != null) {
                addOption(ConfigOption.runnableButton(button.name(), button.description(), button.category(), button.subcategory(), field, owner, button.text()));
                continue;
            }

            // Un-annotated state (such as `enabled`) still has to survive a restart.
            if (Modifier.isFinal(field.getModifiers()) || Runnable.class.isAssignableFrom(field.getType())) {
                continue;
            }
            if (isSaveable(field.getType())) {
                saved.put(field.getName(), new Object[]{owner, field});
            }
        }

        Method[] methods = clazz.getDeclaredMethods();
        Arrays.sort(methods, new Comparator<Method>() {
            @Override
            public int compare(Method a, Method b) {
                return a.getName().compareTo(b.getName());
            }
        });
        for (Method method : methods) {
            Button button = method.getAnnotation(Button.class);
            if (button == null || method.getParameterTypes().length != 0) continue;
            Object owner = Modifier.isStatic(method.getModifiers()) ? null : instance;
            addOption(ConfigOption.methodButton(button.name(), button.description(), button.category(), button.subcategory(), method, owner, button.text()));
        }
    }

    private static boolean isSaveable(Class<?> type) {
        return type == boolean.class || type == int.class || type == float.class
                || type == double.class || type == long.class || type == String.class;
    }

    private void addOption(ConfigOption option) {
        options.add(option);
        if (!categories.contains(option.category)) {
            categories.add(option.category);
        }
    }

    // ------------------------------------------------- listeners/dependencies

    /** Runs {@code listener} whenever the named option is changed through the GUI. */
    public void addListener(String fieldName, Runnable listener) {
        listeners.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(listener);
    }

    /**
     * Greys {@code fieldName} out in the GUI while the boolean option {@code dependsOn} is off.
     * As in OneConfig this only affects the GUI; the stored value is left untouched, so the
     * animations themselves behave exactly as before.
     */
    public void addDependency(String fieldName, String dependsOn) {
        dependencies.computeIfAbsent(fieldName, k -> new ArrayList<>()).add(dependsOn);
    }

    /** Whether the named option is interactive, given the state of what it depends on. */
    public boolean isOptionEnabled(String fieldName) {
        if (fieldName == null) return true;
        List<String> required = dependencies.get(fieldName);
        if (required == null) return true;
        for (String dependency : required) {
            ConfigOption option = findOption(dependency);
            // OneConfig ignores dependencies that name something which isn't an option.
            if (option != null && option.field.getType() == boolean.class && !option.getBoolean()) {
                return false;
            }
        }
        return true;
    }

    private ConfigOption findOption(String fieldName) {
        for (ConfigOption option : options) {
            if (fieldName.equals(option.fieldName())) return option;
        }
        return null;
    }

    /** Called by the GUI after it changes a value. */
    public void onChanged(String fieldName) {
        if (fieldName == null) return;
        List<Runnable> toRun = listeners.get(fieldName);
        if (toRun == null) return;
        for (Runnable runnable : toRun) {
            try {
                runnable.run();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    // ------------------------------------------------------------------- data

    public List<ConfigOption> getOptions() {
        return options;
    }

    public List<String> getCategories() {
        return categories;
    }

    public String getDisplayName() {
        return displayName;
    }

    /** Kept for source compatibility with OneConfig; loading already happened in the constructor. */
    public void preload() {
        initialize();
    }

    public void openGui() {
        GuiQueue.open(new OverflowSettingsGui(this));
    }

    // ------------------------------------------------------------ persistence

    public void save() {
        JsonObject json = new JsonObject();
        for (Map.Entry<String, Object[]> entry : saved.entrySet()) {
            Field field = (Field) entry.getValue()[1];
            try {
                json.add(entry.getKey(), toJson(field.get(entry.getValue()[0])));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        for (Map.Entry<String, Object> entry : pages.entrySet()) {
            json.add(entry.getKey(), savePage(entry.getValue()));
        }
        try (Writer writer = new FileWriter(configFile)) {
            GSON.toJson(json, writer);
        } catch (Exception e) {
            System.out.println("[OverflowAnimations] Failed to save " + configFile);
            e.printStackTrace();
        }
    }

    private JsonObject savePage(Object page) {
        JsonObject json = new JsonObject();
        for (Field field : page.getClass().getDeclaredFields()) {
            if (!isPersistedPageField(field)) continue;
            field.setAccessible(true);
            Object owner = Modifier.isStatic(field.getModifiers()) ? null : page;
            try {
                json.add(field.getName(), toJson(field.get(owner)));
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        return json;
    }

    private static boolean isPersistedPageField(Field field) {
        return !field.isSynthetic()
                && !field.isAnnotationPresent(Exclude.class)
                && !Modifier.isTransient(field.getModifiers())
                && !Modifier.isFinal(field.getModifiers())
                && !Runnable.class.isAssignableFrom(field.getType())
                && isSaveable(field.getType());
    }

    private static JsonElement toJson(Object value) {
        if (value instanceof Boolean) return new JsonPrimitive((Boolean) value);
        if (value instanceof Number) return new JsonPrimitive((Number) value);
        return new JsonPrimitive(String.valueOf(value));
    }

    private void load() {
        File file = configFile;
        if (!file.exists()) {
            // First run after dropping OneConfig: pick up whatever the OneConfig build left behind.
            File legacy = findLegacyConfig();
            if (legacy == null) {
                save();
                return;
            }
            System.out.println("[OverflowAnimations] Importing settings from " + legacy);
            file = legacy;
        }
        JsonObject json;
        try (Reader reader = new FileReader(file)) {
            JsonElement parsed = new JsonParser().parse(reader);
            if (!parsed.isJsonObject()) return;
            json = parsed.getAsJsonObject();
        } catch (Exception e) {
            System.out.println("[OverflowAnimations] Failed to read " + file + ", falling back to defaults.");
            e.printStackTrace();
            return;
        }
        for (Map.Entry<String, Object[]> entry : saved.entrySet()) {
            apply(json.get(entry.getKey()), (Field) entry.getValue()[1], entry.getValue()[0]);
        }
        for (Map.Entry<String, Object> entry : pages.entrySet()) {
            JsonElement nested = json.get(entry.getKey());
            if (nested == null || !nested.isJsonObject()) continue;
            loadPage(nested.getAsJsonObject(), entry.getValue());
        }
        if (file != configFile) {
            save();
        }
    }

    /** OneConfig kept per-profile copies; the default profile is the one worth importing. */
    private File findLegacyConfig() {
        String name = configFile.getName();
        File[] candidates = {
                new File(configDirectory(), "oneconfig-profiles/Default/" + name),
                new File(configDirectory(), "oneconfig/profiles/Default/" + name)
        };
        for (File candidate : candidates) {
            if (candidate.isFile()) return candidate;
        }
        return null;
    }

    private void loadPage(JsonObject json, Object page) {
        for (Field field : page.getClass().getDeclaredFields()) {
            if (!isPersistedPageField(field)) continue;
            field.setAccessible(true);
            Object owner = Modifier.isStatic(field.getModifiers()) ? null : page;
            apply(json.get(field.getName()), field, owner);
        }
    }

    private static void apply(JsonElement element, Field field, Object owner) {
        if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) return;
        try {
            Class<?> type = field.getType();
            if (type == boolean.class) {
                field.setBoolean(owner, element.getAsBoolean());
            } else if (type == int.class) {
                field.setInt(owner, element.getAsInt());
            } else if (type == float.class) {
                field.setFloat(owner, element.getAsFloat());
            } else if (type == double.class) {
                field.setDouble(owner, element.getAsDouble());
            } else if (type == long.class) {
                field.setLong(owner, element.getAsLong());
            } else if (type == String.class) {
                field.set(owner, element.getAsString());
            }
        } catch (Exception e) {
            // A malformed entry shouldn't cost the user every other setting.
            e.printStackTrace();
        }
    }
}
