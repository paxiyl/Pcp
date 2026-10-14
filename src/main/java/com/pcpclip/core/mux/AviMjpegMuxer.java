package com.pcpclip.core.mux;

import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Minimal AVI writer for Motion JPEG.
 *
 * <p>Written by hand rather than pulled from a library: AVI is a simple RIFF format, and owning
 * it means there is no native dependency and nothing to go wrong on an unusual JRE. Android video
 * players (VLC, MX Player) and every desktop player read MJPEG AVI.
 *
 * <p>AVI has one frame rate for the whole file, so the header is patched at the end with the rate
 * the capture actually achieved. Playback length therefore matches real time even when the game's
 * frame rate wandered - the alternative, declaring the requested rate, would make clips play at
 * the wrong speed.
 */
public final class AviMjpegMuxer implements Muxer {

    private static final int AVIF_HASINDEX = 0x10;
    private static final int AVI_KEYFRAME = 0x10;

    /**
     * Byte offsets of the two headers that have to be patched once the clip is complete.
     * RIFF header (12) + hdrl LIST header (12) + avih chunk header (8) puts the main header's
     * payload at 32; the stream header's payload follows the 56-byte avih payload, the strl LIST
     * header (12) and the strh chunk header (8).
     */
    private static final long AVIH_PAYLOAD = 32L;
    private static final long STRH_PAYLOAD = AVIH_PAYLOAD + 56L + 12L + 8L;

    private final File target;
    private final int width;
    private final int height;
    private final int nominalFps;
    private final RandomAccessFile out;

    private long moviListStart;
    private long moviDataStart;
    private int frameCount;
    private int largestFrame;
    private long totalPayload;
    private long firstPtsNanos = -1L;
    private long lastPtsNanos;
    /** chunk offset / size pairs for idx1 */
    private int[] offsets = new int[1024];
    private int[] sizes = new int[1024];
    private boolean finished;

    public AviMjpegMuxer(File target, int width, int height, int nominalFps) throws IOException {
        this.target = target;
        this.width = width;
        this.height = height;
        this.nominalFps = Math.max(1, nominalFps);
        File parent = target.getParentFile();
        if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
            throw new IOException("Could not create " + parent);
        }
        this.out = new RandomAccessFile(target, "rw");
        out.setLength(0L);
        writeHeaders();
    }

    @Override
    public File file() {
        return target;
    }

    @Override
    public String describe() {
        return "AVI (Motion JPEG)";
    }

    private void writeHeaders() throws IOException {
        fourcc("RIFF");
        u32(0);                      // patched in finish()
        fourcc("AVI ");

        fourcc("LIST");
        u32(192);                    // hdrl payload: 'hdrl' + avih chunk + strl list
        fourcc("hdrl");

        fourcc("avih");
        u32(56);
        u32(1000000 / nominalFps);   // dwMicroSecPerFrame, patched in finish()
        u32(0);                      // dwMaxBytesPerSec, patched
        u32(0);                      // dwPaddingGranularity
        u32(AVIF_HASINDEX);          // dwFlags
        u32(0);                      // dwTotalFrames, patched
        u32(0);                      // dwInitialFrames
        u32(1);                      // dwStreams
        u32(0);                      // dwSuggestedBufferSize, patched
        u32(width);
        u32(height);
        u32(0);
        u32(0);
        u32(0);
        u32(0);

        fourcc("LIST");
        u32(116);                    // strl payload: 'strl' + strh chunk + strf chunk
        fourcc("strl");

        fourcc("strh");
        u32(56);
        fourcc("vids");
        fourcc("MJPG");
        u32(0);                      // dwFlags
        u16(0);                      // wPriority
        u16(0);                      // wLanguage
        u32(0);                      // dwInitialFrames
        u32(1000);                   // dwScale
        u32(1000 * nominalFps);      // dwRate, patched in finish()
        u32(0);                      // dwStart
        u32(0);                      // dwLength, patched
        u32(0);                      // dwSuggestedBufferSize, patched
        u32(0xFFFFFFFF);             // dwQuality: driver default
        u32(0);                      // dwSampleSize
        u16(0);
        u16(0);
        u16(width);
        u16(height);

        fourcc("strf");
        u32(40);
        u32(40);                     // biSize
        u32(width);
        u32(height);
        u16(1);                      // biPlanes
        u16(24);                     // biBitCount
        fourcc("MJPG");              // biCompression
        u32(width * height * 3);     // biSizeImage
        u32(0);
        u32(0);
        u32(0);
        u32(0);

        moviListStart = out.getFilePointer();
        fourcc("LIST");
        u32(0);                      // patched in finish()
        fourcc("movi");
        moviDataStart = out.getFilePointer();
    }

    @Override
    public void writeFrame(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
            throws IOException {
        if (finished) {
            return;
        }
        if (firstPtsNanos < 0L) {
            firstPtsNanos = ptsNanos;
        }
        lastPtsNanos = ptsNanos;

        if (frameCount == offsets.length) {
            int[] grownOffsets = new int[offsets.length * 2];
            int[] grownSizes = new int[sizes.length * 2];
            System.arraycopy(offsets, 0, grownOffsets, 0, offsets.length);
            System.arraycopy(sizes, 0, grownSizes, 0, sizes.length);
            offsets = grownOffsets;
            sizes = grownSizes;
        }
        long chunkStart = out.getFilePointer();
        offsets[frameCount] = (int) (chunkStart - moviDataStart);
        sizes[frameCount] = length;

        fourcc("00dc");
        u32(length);
        out.write(data, offset, length);
        if ((length & 1) == 1) {
            out.write(0);            // RIFF chunks are word aligned
        }

        frameCount++;
        totalPayload += length;
        if (length > largestFrame) {
            largestFrame = length;
        }
    }

    @Override
    public void finish() throws IOException {
        if (finished) {
            return;
        }
        finished = true;

        long moviEnd = out.getFilePointer();
        long moviPayload = moviEnd - (moviListStart + 8L);

        // idx1
        fourcc("idx1");
        u32(frameCount * 16);
        for (int i = 0; i < frameCount; i++) {
            fourcc("00dc");
            u32(AVI_KEYFRAME);       // every Motion JPEG frame stands alone
            u32(offsets[i]);
            u32(sizes[i]);
        }

        long fileEnd = out.getFilePointer();

        // Patch RIFF size.
        out.seek(4L);
        u32((int) (fileEnd - 8L));

        // Patch the fields that could only be known once every frame had arrived.
        int effectiveFps = measuredFps();
        int microsPerFrame = Math.max(1, (int) Math.round(1000000.0 / effectiveFps));
        long seconds = Math.max(1L, Math.round(durationSeconds()));
        out.seek(AVIH_PAYLOAD);
        u32(microsPerFrame);                     // dwMicroSecPerFrame
        u32((int) Math.min(Integer.MAX_VALUE, totalPayload / seconds));  // dwMaxBytesPerSec
        out.seek(AVIH_PAYLOAD + 16L);
        u32(frameCount);                         // dwTotalFrames
        out.seek(AVIH_PAYLOAD + 28L);
        u32(largestFrame);                       // dwSuggestedBufferSize

        out.seek(STRH_PAYLOAD + 20L);
        u32(1000);                               // dwScale
        u32(1000 * effectiveFps);                // dwRate
        out.seek(STRH_PAYLOAD + 32L);
        u32(frameCount);                         // dwLength
        u32(largestFrame);                       // dwSuggestedBufferSize

        // Patch the movi LIST size.
        out.seek(moviListStart + 4L);
        u32((int) moviPayload);

        out.seek(fileEnd);
        try {
            out.getFD().sync();
        } catch (IOException syncFailed) {
            PcpLog.debug("avi sync failed: " + syncFailed.getMessage());
        }
        closeQuietly();
    }

    /** Frames per second the capture actually achieved, used for the container's single rate. */
    public int measuredFps() {
        double seconds = durationSeconds();
        if (frameCount < 2 || seconds <= 0.0) {
            return nominalFps;
        }
        // frameCount - 1 intervals span the measured duration.
        int measured = (int) Math.round((frameCount - 1) / seconds);
        return Math.max(1, Math.min(480, measured));
    }

    public double durationSeconds() {
        if (firstPtsNanos < 0L || lastPtsNanos <= firstPtsNanos) {
            return frameCount / (double) nominalFps;
        }
        return (lastPtsNanos - firstPtsNanos) / 1_000_000_000.0;
    }

    @Override
    public int frameCount() {
        return frameCount;
    }

    @Override
    public void close() {
        if (!finished) {
            finished = true;
            closeQuietly();
            if (target.exists() && !target.delete()) {
                PcpLog.debug("could not delete abandoned " + target);
            }
        }
    }

    private void closeQuietly() {
        try {
            out.close();
        } catch (IOException ignored) {
            // nothing useful to do
        }
    }

    private void fourcc(String value) throws IOException {
        out.write(value.charAt(0));
        out.write(value.charAt(1));
        out.write(value.charAt(2));
        out.write(value.charAt(3));
    }

    /** RIFF is little endian throughout. */
    private void u32(int value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >>> 8) & 0xFF);
        out.write((value >>> 16) & 0xFF);
        out.write((value >>> 24) & 0xFF);
    }

    private void u16(int value) throws IOException {
        out.write(value & 0xFF);
        out.write((value >>> 8) & 0xFF);
    }
}
