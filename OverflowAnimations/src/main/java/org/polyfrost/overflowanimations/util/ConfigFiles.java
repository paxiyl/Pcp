package org.polyfrost.overflowanimations.util;

import java.io.File;

/**
 * Replaces OneConfig's {@code ConfigUtils.getProfileFile}. Looks in the plain config folder
 * first, then in the folders OneConfig used for its profiles, so a config written by an
 * earlier OneConfig-based install is still found.
 */
public class ConfigFiles {

    private ConfigFiles() {
    }

    public static File locate(String name) {
        File[] candidates = {
                new File("config", name),
                new File("config/oneconfig-profiles/Default", name),
                new File("config/oneconfig/profiles/Default", name)
        };
        for (File candidate : candidates) {
            if (candidate.isFile()) return candidate;
        }
        return candidates[0];
    }
}
