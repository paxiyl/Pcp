package org.polyfrost.overflowanimations;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.stream.MalformedJsonException;
import net.minecraft.launchwrapper.Launch;
import net.minecraftforge.fml.relauncher.IFMLLoadingPlugin;

import java.io.File;
import java.io.InputStream;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Removes Sk1er's Old Animations if it is installed alongside this mod, since the two replace
 * each other and conflict.
 *
 * <p>The original reported this through a Swing dialog and then killed the JVM. Swing is absent
 * or non-functional on the Android JREs PojavLauncher uses — merely touching {@code java.awt}
 * there can take the game down — so the report goes to the game log and the launch carries on.
 */
public class ModDetectorPlugin implements IFMLLoadingPlugin {

    public ModDetectorPlugin() {
        try {
            File modsFolder = new File(Launch.minecraftHome, "mods");
            File[] modFolder = modsFolder.listFiles((dir, name) -> name.endsWith(".jar"));
            if (modFolder == null) {
                return;
            }
            final JsonParser parser = new JsonParser();
            File oldFile = null;
            for (File file : modFolder) {
                try {
                    try (ZipFile mod = new ZipFile(file)) {
                        ZipEntry entry = mod.getEntry("mcmod.info");
                        if (entry == null) {
                            continue;
                        }
                        try (InputStream inputStream = mod.getInputStream(entry)) {
                            byte[] availableBytes = new byte[inputStream.available()];
                            inputStream.read(availableBytes, 0, inputStream.available());
                            JsonObject modInfo = parser.parse(new String(availableBytes)).getAsJsonArray().get(0).getAsJsonObject();
                            if (!modInfo.has("modid") || !modInfo.has("version")) {
                                continue;
                            }

                            String modid = modInfo.get("modid").getAsString();
                            if (modid.equals("sk1er_old_animations")) {
                                oldFile = file;
                                break;
                            }
                        }
                    }
                } catch (MalformedJsonException | IllegalStateException ignored) {
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            if (oldFile == null) {
                return;
            }

            boolean deleted = oldFile.delete();
            if (!deleted) {
                oldFile.deleteOnExit();
            }
            warn("================================================================");
            warn("You have both Sk1er Old Animations and OverflowAnimations installed.");
            warn("OverflowAnimations replaces Sk1er Old Animations, so running both breaks things.");
            if (deleted) {
                warn("Sk1er Old Animations has been removed for you. Please restart your game.");
            } else {
                warn("It could not be removed automatically; delete it yourself:");
                warn("  " + oldFile.getAbsolutePath());
            }
            warn("================================================================");
        } catch (Exception ignored) {
        }
    }

    private static void warn(String message) {
        System.out.println("[OverflowAnimations] " + message);
    }

    @Override
    public String[] getASMTransformerClass() {
        return new String[0];
    }

    @Override
    public String getModContainerClass() {
        return null;
    }

    @Override
    public String getSetupClass() {
        return null;
    }

    @Override
    public void injectData(Map<String, Object> map) {

    }

    @Override
    public String getAccessTransformerClass() {
        return null;
    }
}
