package com.pcpclip.core.codec;

import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferByte;
import java.io.IOException;
import java.util.Iterator;

/**
 * Motion JPEG using the JRE's own JPEG encoder.
 *
 * <p>This is the fallback that works everywhere, because every JRE Pojav ships - including the
 * Java 8 and Java 17 runtimes - carries a native JPEG writer. It costs far less CPU than
 * software H.264 and never stalls, at the price of much larger files, and every frame is a
 * keyframe so clip trimming is exact.
 *
 * <p>The image raster is allocated once and written in place, so steady-state encoding allocates
 * only the compressed output.
 */
public final class MjpegEncoder implements VideoEncoder {

    private final int width;
    private final int height;
    private final float quality;
    private final BufferedImage image;
    private final byte[] bgr;
    private byte[] scratchRow = new byte[0];
    private final ImageWriter writer;
    private final ImageWriteParam params;
    private final GrowableBuffer compressed;
    private boolean closed;

    public MjpegEncoder(EncoderSpec spec) throws EncoderUnavailableException {
        this.width = spec.width;
        this.height = spec.height;
        this.quality = Math.max(0.1f, Math.min(1.0f, spec.jpegQuality / 100.0f));

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new EncoderUnavailableException(
                    "This Java runtime has no JPEG encoder (ImageIO reports no jpeg writer).");
        }
        this.writer = writers.next();
        this.params = writer.getDefaultWriteParam();
        if (params.canWriteCompressed()) {
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(quality);
        }
        this.image = new BufferedImage(width, height, BufferedImage.TYPE_3BYTE_BGR);
        this.bgr = ((DataBufferByte) image.getRaster().getDataBuffer()).getData();
        // A quality-55 1080p frame lands around 100 KB; start there and let it grow if needed.
        this.compressed = new GrowableBuffer(Math.max(65536, width * height / 8));
    }

    @Override
    public String name() {
        return "Motion JPEG (ImageIO, q" + Math.round(quality * 100) + ")";
    }

    @Override
    public SegmentCodec codec() {
        return SegmentCodec.MJPEG;
    }

    @Override
    public void encode(VideoFrame frame, PacketSink sink) throws IOException {
        if (closed) {
            return;
        }
        OutputGeometry geometry = frame.geometry();
        ensureScratchRow(frame.width());
        ColorConvert.rgbaToBgr(frame.pixels(), frame.width(), frame.height(), geometry,
                scratchRow, bgr);

        compressed.reset();
        MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(compressed);
        try {
            writer.setOutput(out);
            writer.write(null, new IIOImage(image, null, null), params);
            out.flush();
        } finally {
            out.close();
        }
        // Hand the sink our own backing array rather than a copy; the sink contract says the
        // bytes are only valid for the duration of the call, which the segment writer honours.
        sink.packet(compressed.array(), 0, compressed.size(), frame.ptsNanos(), true);
    }

    private void ensureScratchRow(int sourceWidth) {
        int needed = sourceWidth * 4;
        if (scratchRow.length < needed) {
            scratchRow = new byte[needed];
        }
    }

    @Override
    public void finish(PacketSink sink) {
        // Motion JPEG holds nothing back.
    }

    /** Exposes the accumulated bytes without the copy {@code toByteArray()} would make. */
    private static final class GrowableBuffer extends java.io.ByteArrayOutputStream {

        GrowableBuffer(int initialCapacity) {
            super(initialCapacity);
        }

        byte[] array() {
            return buf;
        }
    }

    @Override
    public void close() {
        if (!closed) {
            closed = true;
            try {
                writer.dispose();
            } catch (RuntimeException ignored) {
                // disposing a writer twice is harmless
            }
        }
    }
}
