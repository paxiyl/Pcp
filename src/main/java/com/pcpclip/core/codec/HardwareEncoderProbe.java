package com.pcpclip.core.codec;

import com.pcpclip.core.util.PcpLog;

/**
 * Finds out - once, at startup - whether a hardware encoder is reachable, and records why not.
 *
 * <p>The checks are deliberately cheap and side effect free: a missing class must not produce a
 * stack trace in the log on every launch, and nothing here may load Android classes speculatively.
 */
public final class HardwareEncoderProbe {

    /** System property a launcher-side plugin can point at a {@link HardwareEncoderBridge}. */
    public static final String BRIDGE_PROPERTY = "pcpclip.hardwareBridge";

    private static volatile HardwareEncoderProbe instance;

    private final HardwareEncoderBridge bridge;
    private final String detail;

    private HardwareEncoderProbe(HardwareEncoderBridge bridge, String detail) {
        this.bridge = bridge;
        this.detail = detail;
    }

    public static HardwareEncoderProbe get() {
        HardwareEncoderProbe local = instance;
        if (local == null) {
            synchronized (HardwareEncoderProbe.class) {
                local = instance;
                if (local == null) {
                    local = probe();
                    instance = local;
                }
            }
        }
        return local;
    }

    private static HardwareEncoderProbe probe() {
        String bridgeClass = System.getProperty(BRIDGE_PROPERTY);
        if (bridgeClass != null && !bridgeClass.trim().isEmpty()) {
            try {
                Class<?> type = Class.forName(bridgeClass.trim());
                Object candidate = type.newInstance();
                if (candidate instanceof HardwareEncoderBridge) {
                    HardwareEncoderBridge found = (HardwareEncoderBridge) candidate;
                    PcpLog.info("Hardware encoder bridge registered: " + found.describe());
                    return new HardwareEncoderProbe(found, "bridge: " + found.describe());
                }
                return new HardwareEncoderProbe(null,
                        bridgeClass + " does not implement HardwareEncoderBridge");
            } catch (Throwable error) {
                return new HardwareEncoderProbe(null,
                        "bridge " + bridgeClass + " could not be loaded: " + error);
            }
        }

        // Without a bridge, check whether we are somehow running on a JVM that does expose the
        // Android framework (a future Pojav runtime, or a desktop test harness that stubs it).
        try {
            Class.forName("android.media.MediaCodec", false, HardwareEncoderProbe.class.getClassLoader());
            return new HardwareEncoderProbe(null,
                    "android.media.MediaCodec is visible but no bridge implementation is registered; "
                            + "set -D" + BRIDGE_PROPERTY + "=<class> to use it");
        } catch (Throwable notAndroid) {
            return new HardwareEncoderProbe(null,
                    "no hardware encoder: the game JVM has no android.media.MediaCodec and no "
                            + BRIDGE_PROPERTY + " was set");
        }
    }

    public boolean available() {
        return bridge != null;
    }

    public HardwareEncoderBridge bridge() {
        return bridge;
    }

    /** One line explaining what was found, shown verbatim in the encoder status display. */
    public String detail() {
        return detail;
    }
}
