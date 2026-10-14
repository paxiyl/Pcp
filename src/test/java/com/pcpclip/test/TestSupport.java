package com.pcpclip.test;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Tiny test harness: no external dependency, runs on any JRE 8. */
public final class TestSupport {

    private static final List<String> failures = new ArrayList<String>();
    private static int checks;
    private static String currentTest = "";

    private TestSupport() {
    }

    public static void startTest(String name) {
        currentTest = name;
        System.out.println("-- " + name);
    }

    public static void check(boolean condition, String what) {
        checks++;
        if (!condition) {
            String message = currentTest + ": " + what;
            failures.add(message);
            System.out.println("   FAIL  " + what);
        }
    }

    public static void checkEquals(long expected, long actual, String what) {
        check(expected == actual, what + " (expected " + expected + ", got " + actual + ")");
    }

    public static void checkNear(double expected, double actual, double tolerance, String what) {
        check(Math.abs(expected - actual) <= tolerance,
                what + " (expected " + expected + " +/- " + tolerance + ", got " + actual + ")");
    }

    public static void note(String message) {
        System.out.println("   " + message);
    }

    public static int checkCount() {
        return checks;
    }

    public static List<String> failures() {
        return failures;
    }

    public static File tempDirectory(String prefix) throws IOException {
        File directory = File.createTempFile(prefix, "");
        if (!directory.delete() || !directory.mkdirs()) {
            throw new IOException("could not create temp directory " + directory);
        }
        return directory;
    }

    public static void deleteTree(File file) {
        if (file == null) {
            return;
        }
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteTree(child);
            }
        }
        if (!file.delete()) {
            file.deleteOnExit();
        }
    }

    /** Synthetic gameplay-ish frame: a gradient background with a moving block. */
    public static void fillFrame(java.nio.ByteBuffer buffer, int width, int height, int frame) {
        buffer.clear();
        byte[] row = new byte[width * 4];
        int boxX = (frame * 17) % Math.max(1, width - 80);
        int boxY = height / 3;
        for (int y = 0; y < height; y++) {
            boolean boxRow = y > boxY && y < boxY + 80;
            for (int x = 0; x < width; x++) {
                int i = x * 4;
                boolean box = boxRow && x > boxX && x < boxX + 80;
                row[i] = (byte) (box ? 240 : (x * 255 / width));
                row[i + 1] = (byte) (box ? 60 : (y * 255 / height));
                row[i + 2] = (byte) (box ? 60 : ((x + y + frame * 5) & 0xFF));
                row[i + 3] = (byte) 255;
            }
            buffer.put(row);
        }
        buffer.flip();
    }
}
