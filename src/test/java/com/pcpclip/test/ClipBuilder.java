package com.pcpclip.test;

import com.pcpclip.core.codec.EncoderFactory;
import com.pcpclip.core.codec.EncoderSpec;
import com.pcpclip.core.codec.PacketSink;
import com.pcpclip.core.codec.VideoEncoder;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.frame.FramePool;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.mux.Mp4H264Muxer;
import com.pcpclip.core.mux.Muxer;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;

/** Builds small real clips for tests that need a decodable file rather than a buffer. */
final class ClipBuilder {

    private ClipBuilder() {
    }

    /**
     * Encodes the given pixels as a short H.264 clip, repeating the frame so there is something
     * for a decoder to chew on.
     */
    static void writeSingleColourQuadrants(File target, int width, int height, ByteBuffer pixels)
            throws IOException {
        EncoderSpec spec = new EncoderSpec(width, height, 10, 4000, 90, 20,
                EncoderPreference.H264_MP4);
        VideoEncoder encoder;
        try {
            encoder = EncoderFactory.create(spec, EncoderPreference.H264_MP4);
        } catch (Exception unavailable) {
            throw new IOException("H.264 encoder unavailable", unavailable);
        }
        final Muxer muxer = new Mp4H264Muxer(target, width, height, 10);
        PacketSink sink = new PacketSink() {
            @Override
            public void packet(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
                    throws IOException {
                muxer.writeFrame(data, offset, length, ptsNanos, keyframe);
            }
        };
        FramePool pool = new FramePool(width * height * 4, 8L * 1024L * 1024L);
        OutputGeometry geometry = OutputGeometry.identity(width, height);
        try {
            for (int i = 0; i < 3; i++) {
                VideoFrame frame = pool.acquire(width, height, geometry, i * 100_000_000L, i);
                if (frame == null) {
                    throw new IOException("frame pool exhausted");
                }
                frame.pixels().clear();
                pixels.rewind();
                frame.pixels().put(pixels);
                frame.pixels().flip();
                encoder.encode(frame, sink);
                frame.release();
            }
            encoder.finish(sink);
            muxer.finish();
        } finally {
            encoder.close();
            pool.close();
        }
    }
}
