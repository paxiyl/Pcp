package dev.paxiyl.pcp.client;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Properties;

import dev.paxiyl.pcp.core.KnockbackProfile;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ServerData;

/**
 * Stores the learned knockback profile per server under
 * {@code config/pcp/profiles}.
 *
 * <p>Keyed by server address so a profile learned on one server is never
 * applied to another; single-player gets its own key. Plain properties files,
 * so a profile can be inspected or deleted by hand. All IO failures are
 * swallowed with a log line: losing a learned profile must never break the
 * game.</p>
 */
public final class ProfileStore {

    private final File directory;

    public ProfileStore(File configDirectory) {
        this.directory = new File(configDirectory, "pcp" + File.separator + "profiles");
    }

    /** Server address, sanitised into a filename-safe key. */
    public static String serverKey(Minecraft mc) {
        if (mc == null) {
            return "unknown";
        }
        if (mc.isSingleplayer()) {
            return "singleplayer";
        }
        ServerData data = mc.getCurrentServerData();
        String raw = data == null ? null : data.serverIP;
        if (raw == null || raw.isEmpty()) {
            return "unknown";
        }
        StringBuilder sb = new StringBuilder();
        String lower = raw.toLowerCase();
        for (int i = 0; i < lower.length() && sb.length() < 64; i++) {
            char c = lower.charAt(i);
            sb.append((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '.' || c == '-' ? c : '_');
        }
        return sb.length() == 0 ? "unknown" : sb.toString();
    }

    public boolean load(KnockbackProfile profile, String key) {
        File file = fileFor(key);
        if (!file.isFile()) {
            profile.setServerKey(key);
            return false;
        }
        Properties props = new Properties();
        InputStream in = null;
        try {
            in = new FileInputStream(file);
            props.load(in);
        } catch (IOException e) {
            return false;
        } finally {
            close(in);
        }
        Map<String, String> map = new HashMap<String, String>();
        Iterator<Object> it = props.keySet().iterator();
        while (it.hasNext()) {
            Object k = it.next();
            map.put(String.valueOf(k), props.getProperty(String.valueOf(k)));
        }
        profile.fromMap(map);
        profile.setServerKey(key);
        return true;
    }

    public boolean save(KnockbackProfile profile, String key) {
        if (profile == null || key == null) {
            return false;
        }
        File file = fileFor(key);
        File parent = file.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            return false;
        }
        Properties props = new Properties();
        Map<String, String> map = profile.toMap();
        Iterator<Map.Entry<String, String>> it = map.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, String> e = it.next();
            props.setProperty(e.getKey(), e.getValue() == null ? "" : e.getValue());
        }
        OutputStream out = null;
        try {
            out = new FileOutputStream(file);
            props.store(out, "PCP learned knockback samples for " + key
                    + " - client-side estimates, not server settings");
            return true;
        } catch (IOException e) {
            return false;
        } finally {
            close(out);
        }
    }

    public boolean delete(String key) {
        File file = fileFor(key);
        return file.isFile() && file.delete();
    }

    public File fileFor(String key) {
        return new File(this.directory, (key == null ? "unknown" : key) + ".properties");
    }

    private static void close(Object stream) {
        try {
            if (stream instanceof InputStream) {
                ((InputStream) stream).close();
            } else if (stream instanceof OutputStream) {
                ((OutputStream) stream).close();
            }
        } catch (IOException ignored) {
            // Nothing useful to do if a close fails.
        }
    }
}
