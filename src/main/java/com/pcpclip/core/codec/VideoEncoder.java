package com.pcpclip.core.codec;

import com.pcpclip.core.frame.VideoFrame;

import java.io.IOException;

/**
 * Encodes captured frames into packets.
 *
 * <p>One encoder instance belongs to one buffer segment and is only ever touched by the worker
 * thread that owns that segment, so implementations need no locking. Instances are expected to
 * emit a keyframe first, which is what makes a segment independently decodable - and therefore
 * what makes clipping on segment boundaries possible.
 */
public interface VideoEncoder {

    /** Human readable backend name, shown in the status display. */
    String name();

    SegmentCodec codec();

    /**
     * Encodes one frame. The frame's pixels may be read but not retained; the caller releases it
     * as soon as this returns.
     */
    void encode(VideoFrame frame, PacketSink sink) throws IOException;

    /** Flushes anything buffered. Called once, before {@link #close()}. */
    void finish(PacketSink sink) throws IOException;

    /** Releases encoder resources. Must be safe to call twice. */
    void close();
}
