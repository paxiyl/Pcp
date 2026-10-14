package com.pcpclip.core.codec;

/**
 * Seam for a platform hardware encoder.
 *
 * <p>Nothing in this mod implements it, and that is a finding rather than an omission. Pojav runs
 * Minecraft in an OpenJDK VM; Android's framework classes live in the app's ART VM in the same
 * process but are not on the game JVM's classpath, so {@code android.media.MediaCodec} cannot be
 * reached from mod code. Bridging the two VMs needs a native library compiled against Android's
 * JNI surface and loaded on the Pojav side - that is a launcher feature, not something a mod jar
 * can supply, and shipping a guessed {@code .so} would be exactly the kind of incompatible native
 * blob to avoid.
 *
 * <p>If a launcher or companion plugin ever exposes one, it can publish an implementation and set
 * the system property {@code pcpclip.hardwareBridge} to its class name; {@link HardwareEncoderProbe}
 * will find it and the encoder list will offer it. See docs/COMPATIBILITY.md.
 */
public interface HardwareEncoderBridge {

    /** Short description of the backing encoder, for the status display. */
    String describe();

    /** True when this bridge can encode at the requested size and rate right now. */
    boolean supports(int width, int height, int fps);

    /**
     * Creates an encoder. Implementations must emit Annex-B H.264 with an IDR first so a segment
     * stays independently decodable.
     */
    VideoEncoder create(EncoderSpec spec) throws EncoderUnavailableException;
}
