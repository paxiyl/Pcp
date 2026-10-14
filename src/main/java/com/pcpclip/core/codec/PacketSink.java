package com.pcpclip.core.codec;

import java.io.IOException;

/** Receives encoded packets from a {@link VideoEncoder}. */
public interface PacketSink {

    /**
     * @param data      buffer holding the packet; only valid for the duration of the call
     * @param offset    first byte of the packet
     * @param length    packet length in bytes
     * @param ptsNanos  presentation timestamp relative to the start of the recording session
     * @param keyframe  true when the packet can be decoded without earlier packets
     */
    void packet(byte[] data, int offset, int length, long ptsNanos, boolean keyframe) throws IOException;
}
