package com.pcpclip.core.codec;

import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.util.PcpLog;

import org.jcodec.codecs.h264.H264Encoder;
import org.jcodec.codecs.h264.encode.H264FixedRateControl;
import org.jcodec.common.VideoEncoder.EncodedFrame;
import org.jcodec.common.model.ColorSpace;
import org.jcodec.common.model.Picture;

import java.io.IOException;
import java.nio.BufferOverflowException;
import java.nio.ByteBuffer;

/**
 * Pure-Java baseline H.264 through JCodec.
 *
 * <p>JCodec is plain Java with no native code, which is exactly what this environment needs: no
 * {@code .so} to bundle, nothing that cares whether the JVM runs on bionic or glibc. The cost is
 * CPU - this is the expensive backend, and {@link EncoderFactory} only selects it automatically
 * for pixel rates a software encoder can realistically sustain.
 *
 * <p>JCodec emits Annex-B with the SPS and PPS in front of every IDR frame, so a segment whose
 * first frame is an IDR decodes on its own. One encoder is built per segment, which is what gives
 * each segment that leading IDR.
 *
 * <p>This class is only loaded once {@link EncoderCapabilities} has confirmed JCodec is present;
 * the class reference stays lazy so a build without JCodec still runs.
 */
public final class JcodecH264Encoder implements VideoEncoder {

    private final int width;
    private final int height;
    private final int quantiser;
    private final H264Encoder encoder;
    private final Picture picture;
    private final byte[] luma;
    private final byte[] chromaU;
    private final byte[] chromaV;
    private byte[] scratchRow = new byte[0];
    private ByteBuffer output;
    private boolean closed;

    public JcodecH264Encoder(EncoderSpec spec) {
        // H.264 needs even dimensions; the geometry layer guarantees that, but clamp anyway.
        this.width = spec.width & ~1;
        this.height = spec.height & ~1;
        this.quantiser = Math.max(10, Math.min(40, spec.h264Qp));

        this.luma = new byte[width * height];
        this.chromaU = new byte[(width >> 1) * (height >> 1)];
        this.chromaV = new byte[(width >> 1) * (height >> 1)];
        this.picture = Picture.createPicture(width, height,
                new byte[][]{luma, chromaU, chromaV}, ColorSpace.YUV420J);

        this.encoder = new H264Encoder(new H264FixedRateControl(quantiser));
        // A fresh encoder per segment already puts an IDR at the start of every segment, so this
        // only decides whether a long segment gets extra ones. Roughly two seconds keeps the
        // overhead small while giving players somewhere to seek to, and JCodec derives
        // log2_max_frame_num from it - an oversized value overflows its slice header writer.
        this.encoder.setKeyInterval(Math.max(30, Math.min(300, spec.targetFps * 2)));
        // Narrow motion search: the wide default costs a lot of CPU for little gain at these sizes.
        this.encoder.setMotionSearchRange(8);
        this.output = ByteBuffer.allocate(estimateOutputSize());
    }

    private int estimateOutputSize() {
        int estimate;
        try {
            estimate = encoder.estimateBufferSize(picture);
        } catch (RuntimeException error) {
            estimate = 0;
        }
        return Math.max(estimate, width * height * 3 / 2 + 65536);
    }

    @Override
    public String name() {
        return "H.264 baseline (JCodec, qp" + quantiser + ")";
    }

    @Override
    public SegmentCodec codec() {
        return SegmentCodec.H264;
    }

    @Override
    public void encode(VideoFrame frame, PacketSink sink) throws IOException {
        if (closed) {
            return;
        }
        int neededScratch = frame.width() * 4;
        if (scratchRow.length < neededScratch) {
            scratchRow = new byte[neededScratch];
        }
        ColorConvert.rgbaToYuv420(frame.pixels(), frame.width(), frame.height(), frame.geometry(),
                scratchRow, luma, chromaU, chromaV);

        EncodedFrame encoded;
        try {
            output.clear();
            encoded = encoder.encodeFrame(picture, output);
        } catch (BufferOverflowException overflow) {
            // A very busy frame can exceed JCodec's own estimate; grow once and retry.
            int grown = Math.min(output.capacity() * 2, width * height * 4 + 1048576);
            PcpLog.debug("H.264 packet overflowed " + output.capacity() + " bytes, growing to " + grown);
            output = ByteBuffer.allocate(grown);
            output.clear();
            encoded = encoder.encodeFrame(picture, output);
        }

        ByteBuffer data = encoded.getData();
        int length = data.remaining();
        byte[] packet = new byte[length];
        data.get(packet);
        sink.packet(packet, 0, length, frame.ptsNanos(), encoded.isKeyFrame());
    }

    @Override
    public void finish(PacketSink sink) {
        // JCodec's baseline encoder has no reordering delay, so nothing is pending.
    }

    @Override
    public void close() {
        closed = true;
    }
}
