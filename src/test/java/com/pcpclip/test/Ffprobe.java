package com.pcpclip.test;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Independent verification that a produced clip really is a playable video file.
 *
 * <p>Checking our own muxers with our own code would prove very little, so the test suite asks
 * ffprobe instead when it is on the path. Nothing in the mod itself uses or needs ffmpeg.
 */
final class Ffprobe {

    private static Boolean available;

    private Ffprobe() {
    }

    static boolean available() {
        if (available == null) {
            available = Boolean.valueOf(run(new String[]{"ffprobe", "-version"}) != null);
        }
        return available.booleanValue();
    }

    /** Stream and container facts, or null when ffprobe could not read the file. */
    static Map<String, String> probe(File file) {
        List<String> lines = run(new String[]{
                "ffprobe", "-v", "error",
                "-select_streams", "v:0",
                "-count_frames",
                "-show_entries",
                "stream=codec_name,width,height,nb_read_frames,r_frame_rate:format=duration,format_name",
                "-of", "default=noprint_wrappers=1",
                file.getAbsolutePath()});
        if (lines == null) {
            return null;
        }
        Map<String, String> values = new HashMap<String, String>();
        for (String line : lines) {
            int equals = line.indexOf('=');
            if (equals > 0) {
                values.put(line.substring(0, equals), line.substring(equals + 1));
            }
        }
        return values.isEmpty() ? null : values;
    }

    /** True when every frame decodes without an error. */
    static boolean decodes(File file) {
        List<String> output = run(new String[]{
                "ffmpeg", "-v", "error", "-i", file.getAbsolutePath(), "-f", "null", "-"});
        return output != null && output.isEmpty();
    }

    private static List<String> run(String[] command) {
        Process process = null;
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectErrorStream(true);
            process = builder.start();
            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), "UTF-8"));
            List<String> lines = new ArrayList<String>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.trim().isEmpty()) {
                    lines.add(line.trim());
                }
            }
            reader.close();
            int exit = process.waitFor();
            return exit == 0 ? lines : null;
        } catch (IOException missing) {
            return null;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return null;
        } finally {
            if (process != null) {
                process.destroy();
            }
        }
    }
}
