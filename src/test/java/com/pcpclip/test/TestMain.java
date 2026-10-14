package com.pcpclip.test;

import com.pcpclip.core.codec.EncoderCapabilities;
import com.pcpclip.core.util.PcpLog;

import java.util.List;

/**
 * Runs the core test suite. No test framework, so it can run on whatever JRE is at hand - the
 * same reason the mod itself avoids dependencies.
 */
public final class TestMain {

    private TestMain() {
    }

    public static void main(String[] args) throws Exception {
        long started = System.currentTimeMillis();
        System.out.println("PcpClip core tests");
        System.out.println("java " + System.getProperty("java.version")
                + " on " + System.getProperty("os.name") + " " + System.getProperty("os.arch")
                + ", " + Runtime.getRuntime().availableProcessors() + " cpus");
        System.out.println("ffprobe available: " + Ffprobe.available());
        for (String note : EncoderCapabilities.get().notes()) {
            System.out.println("  " + note);
        }
        System.out.println();

        GeometryTests.run();
        ConfigTests.run();
        SegmentTests.run();
        ExportTests.run();
        RecordingTests.run();

        List<String> failures = TestSupport.failures();
        long seconds = (System.currentTimeMillis() - started) / 1000L;
        System.out.println();
        System.out.println("checks: " + TestSupport.checkCount() + ", failures: " + failures.size()
                + ", time: " + seconds + "s");
        if (!failures.isEmpty()) {
            System.out.println();
            for (String failure : failures) {
                System.out.println("FAILED  " + failure);
            }
            System.exit(1);
        }
        System.out.println("ALL TESTS PASSED");
    }
}
