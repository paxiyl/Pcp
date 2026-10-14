package com.pcpclip.core.storage;

import com.pcpclip.core.util.PcpLog;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilenameFilter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The saved clips, discovered by scanning the clip folder.
 *
 * <p>Scanning rather than keeping an index means the library is always right: clips deleted from
 * a file manager disappear, clips copied in appear, and there is no index to corrupt. Capture
 * details that cannot be recovered from the video itself live in a small sidecar file next to it.
 */
public final class ClipLibrary {

    private static final String SIDECAR_SUFFIX = ".pcpinfo";

    private final StorageManager storage;

    public ClipLibrary(StorageManager storage) {
        this.storage = storage;
    }

    /** Saved clips, newest first. */
    public List<ClipEntry> list() {
        File directory = storage.clipDirectory();
        File[] files = directory.listFiles(new FilenameFilter() {
            @Override
            public boolean accept(File dir, String name) {
                String lower = name.toLowerCase(Locale.ROOT);
                return lower.endsWith(".mp4") || lower.endsWith(".avi");
            }
        });
        List<ClipEntry> entries = new ArrayList<ClipEntry>();
        if (files == null) {
            return entries;
        }
        for (File file : files) {
            entries.add(read(file));
        }
        Collections.sort(entries, new Comparator<ClipEntry>() {
            @Override
            public int compare(ClipEntry a, ClipEntry b) {
                return Long.valueOf(b.savedAtMillis).compareTo(a.savedAtMillis);
            }
        });
        return entries;
    }

    public long totalBytes() {
        long total = 0L;
        for (ClipEntry entry : list()) {
            total += entry.sizeBytes;
        }
        return total;
    }

    /**
     * Enforces an optional cap on the clip folder by deleting the oldest clips.
     *
     * <p>Off unless the user asks for it ({@code storage.maxLibraryGb}, default 0), because
     * silently deleting someone's saved clips to make room is not a decision a recording mod
     * should take on its own. The usual behaviour is to warn about space and stop recording.
     *
     * @param maxBytes cap in bytes; 0 or less means never delete anything
     * @return the clips that were removed, oldest first
     */
    public List<ClipEntry> pruneTo(long maxBytes) {
        List<ClipEntry> removed = new ArrayList<ClipEntry>();
        if (maxBytes <= 0L) {
            return removed;
        }
        List<ClipEntry> entries = list();                 // newest first
        long total = 0L;
        for (ClipEntry entry : entries) {
            total += entry.sizeBytes;
        }
        // Walk from the oldest end while the folder is over the cap.
        for (int i = entries.size() - 1; i >= 0 && total > maxBytes; i--) {
            ClipEntry oldest = entries.get(i);
            if (delete(oldest)) {
                total -= oldest.sizeBytes;
                removed.add(oldest);
                PcpLog.info("clip folder over its cap; deleted " + oldest.name());
            } else {
                PcpLog.warn("Could not delete " + oldest.name() + " while enforcing the clip cap");
                break;
            }
        }
        return removed;
    }

    public boolean delete(ClipEntry entry) {
        File sidecar = sidecarFor(entry.file);
        if (sidecar.exists() && !sidecar.delete()) {
            PcpLog.debug("could not delete sidecar " + sidecar);
        }
        return entry.file.delete();
    }

    private ClipEntry read(File file) {
        Map<String, String> meta = readSidecar(sidecarFor(file));
        return new ClipEntry(file, file.length(),
                parseLong(meta.get("savedAt"), file.lastModified()),
                (int) parseLong(meta.get("width"), 0L),
                (int) parseLong(meta.get("height"), 0L),
                (int) parseLong(meta.get("frames"), 0L),
                parseDouble(meta.get("durationSeconds"), 0.0),
                parseDouble(meta.get("measuredFps"), 0.0),
                (int) parseLong(meta.get("targetFps"), 0L),
                meta.containsKey("codec") ? meta.get("codec") : containerOf(file),
                meta.get("note"));
    }

    private static String containerOf(File file) {
        String name = file.getName().toLowerCase(Locale.ROOT);
        return name.endsWith(".mp4") ? "h264" : "mjpeg";
    }

    public File sidecarFor(File clip) {
        return new File(clip.getParentFile(), clip.getName() + SIDECAR_SUFFIX);
    }

    /**
     * Writes the capture details beside a clip.
     *
     * <p>This is where the honest numbers are recorded: the frame rate that was asked for, the
     * frame rate actually captured, how many frames were dropped and which encoder produced the
     * file. A clip that says 120 fps in its settings but captured 47 will say so here.
     */
    public void writeSidecar(File clip, Map<String, String> values) {
        PrintWriter out = null;
        try {
            out = new PrintWriter(new OutputStreamWriter(
                    new FileOutputStream(sidecarFor(clip)), "UTF-8"));
            out.println("# PcpClip capture details for " + clip.getName());
            for (Map.Entry<String, String> entry : values.entrySet()) {
                out.println(entry.getKey() + "=" + sanitiseValue(entry.getValue()));
            }
            out.flush();
        } catch (IOException error) {
            PcpLog.warn("Could not write clip details for " + clip.getName(), error);
        } finally {
            if (out != null) {
                out.close();
            }
        }
    }

    private static String sanitiseValue(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\n', ' ').replace('\r', ' ');
    }

    private Map<String, String> readSidecar(File sidecar) {
        Map<String, String> values = new HashMap<String, String>();
        if (!sidecar.isFile()) {
            return values;
        }
        BufferedReader reader = null;
        try {
            reader = new BufferedReader(new InputStreamReader(new FileInputStream(sidecar), "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty() || line.charAt(0) == '#') {
                    continue;
                }
                int equals = line.indexOf('=');
                if (equals > 0) {
                    values.put(line.substring(0, equals).trim(), line.substring(equals + 1).trim());
                }
            }
        } catch (IOException error) {
            PcpLog.debug("unreadable sidecar " + sidecar.getName() + ": " + error.getMessage());
        } finally {
            if (reader != null) {
                try {
                    reader.close();
                } catch (IOException ignored) {
                    // nothing useful to do
                }
            }
        }
        return values;
    }

    private static long parseLong(String raw, long fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static double parseDouble(String raw, double fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return Double.parseDouble(raw.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}
