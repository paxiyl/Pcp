package com.pcpclip.core.mux;

import com.pcpclip.core.util.PcpLog;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

/**
 * Minimal MP4 writer for H.264, written by hand for the same reason as the AVI writer: no native
 * code, no large dependency, and complete control over timing.
 *
 * <p>Incoming packets are Annex-B (what JCodec produces). The muxer strips the start codes, moves
 * the parameter sets into the {@code avcC} sample description, and writes length-prefixed samples
 * - the layout MP4 requires and that Android's own players expect.
 *
 * <p>Timing is per-sample, taken from real capture timestamps, so a clip recorded while the frame
 * rate wandered still plays back at the right speed instead of drifting. A fixed-rate export
 * simply hands this class evenly spaced timestamps.
 */
public final class Mp4H264Muxer implements Muxer {

    /** 90 kHz: fine enough for 240 fps and good for durations up to about 13 hours. */
    private static final int TIMESCALE = 90000;

    private final File target;
    private final int width;
    private final int height;
    private final int nominalFps;
    private final RandomAccessFile out;

    private long mdatStart;
    private long firstSampleOffset = -1L;
    private int frameCount;
    private long firstPtsNanos = -1L;
    private long lastPtsNanos;

    private int[] sampleSizes = new int[1024];
    private long[] samplePts = new long[1024];
    private int[] keyframeIndexes = new int[256];
    private int keyframeCount;

    private byte[] sps;
    private byte[] pps;
    private boolean finished;

    public Mp4H264Muxer(File target, int width, int height, int nominalFps) throws IOException {
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
        writeFtyp();
        mdatStart = out.getFilePointer();
        out.writeInt(0);             // mdat size, patched in finish()
        writeFourcc("mdat");
    }

    @Override
    public File file() {
        return target;
    }

    @Override
    public String describe() {
        return "MP4 (H.264 baseline)";
    }

    private void writeFtyp() throws IOException {
        // header (8) + major brand (4) + minor version (4) + four compatible brands (16)
        out.writeInt(8 + 4 + 4 + 4 * 4);
        writeFourcc("ftyp");
        writeFourcc("isom");
        out.writeInt(0x200);
        writeFourcc("isom");
        writeFourcc("iso2");
        writeFourcc("avc1");
        writeFourcc("mp41");
    }

    @Override
    public void writeFrame(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
            throws IOException {
        if (finished) {
            return;
        }
        // Walk the Annex-B units: parameter sets go into avcC, everything else becomes a sample.
        int sampleBytes = 0;
        long sampleStart = out.getFilePointer();

        int cursor = offset;
        int end = offset + length;
        while (cursor < end) {
            int start = findStartCode(data, cursor, end);
            if (start < 0) {
                break;
            }
            int startCodeLength = (start + 2 < end && data[start + 2] == 1) ? 3 : 4;
            int unitStart = start + startCodeLength;
            if (unitStart >= end) {
                break;
            }
            int next = findStartCode(data, unitStart, end);
            int unitEnd = next < 0 ? end : next;
            int unitLength = unitEnd - unitStart;
            if (unitLength <= 0) {
                cursor = unitEnd;
                continue;
            }
            int nalType = data[unitStart] & 0x1F;
            if (nalType == 7) {
                if (sps == null) {
                    sps = copy(data, unitStart, unitLength);
                }
            } else if (nalType == 8) {
                if (pps == null) {
                    pps = copy(data, unitStart, unitLength);
                }
            } else {
                out.writeInt(unitLength);
                out.write(data, unitStart, unitLength);
                sampleBytes += 4 + unitLength;
            }
            cursor = unitEnd;
        }

        if (sampleBytes == 0) {
            // Parameter sets only; nothing to present. Rewind so no gap is left in mdat.
            out.seek(sampleStart);
            return;
        }
        if (firstSampleOffset < 0L) {
            firstSampleOffset = sampleStart;
        }
        if (firstPtsNanos < 0L) {
            firstPtsNanos = ptsNanos;
        }
        lastPtsNanos = ptsNanos;

        if (frameCount == sampleSizes.length) {
            int[] grownSizes = new int[sampleSizes.length * 2];
            long[] grownPts = new long[samplePts.length * 2];
            System.arraycopy(sampleSizes, 0, grownSizes, 0, sampleSizes.length);
            System.arraycopy(samplePts, 0, grownPts, 0, samplePts.length);
            sampleSizes = grownSizes;
            samplePts = grownPts;
        }
        sampleSizes[frameCount] = sampleBytes;
        samplePts[frameCount] = ptsNanos - firstPtsNanos;
        if (keyframe) {
            if (keyframeCount == keyframeIndexes.length) {
                int[] grown = new int[keyframeIndexes.length * 2];
                System.arraycopy(keyframeIndexes, 0, grown, 0, keyframeIndexes.length);
                keyframeIndexes = grown;
            }
            keyframeIndexes[keyframeCount++] = frameCount + 1;   // stss is 1-based
        }
        frameCount++;
    }

    private static int findStartCode(byte[] data, int from, int end) {
        for (int i = from; i + 2 < end; i++) {
            if (data[i] == 0 && data[i + 1] == 0) {
                if (data[i + 2] == 1) {
                    return i;
                }
                if (i + 3 < end && data[i + 2] == 0 && data[i + 3] == 1) {
                    return i;
                }
            }
        }
        return -1;
    }

    private static byte[] copy(byte[] data, int offset, int length) {
        byte[] result = new byte[length];
        System.arraycopy(data, offset, result, 0, length);
        return result;
    }

    @Override
    public void finish() throws IOException {
        if (finished) {
            return;
        }
        finished = true;
        if (frameCount == 0 || sps == null || pps == null) {
            closeQuietly();
            if (target.exists() && !target.delete()) {
                PcpLog.debug("could not delete empty " + target);
            }
            throw new IOException("Nothing to mux: " + frameCount + " samples, parameter sets "
                    + (sps != null ? "sps " : "") + (pps != null ? "pps" : "missing"));
        }

        long mdatEnd = out.getFilePointer();
        out.seek(mdatStart);
        out.writeInt((int) (mdatEnd - mdatStart));
        out.seek(mdatEnd);

        byte[] moov = buildMoov();
        out.write(moov);
        long fileEnd = out.getFilePointer();
        out.setLength(fileEnd);
        try {
            out.getFD().sync();
        } catch (IOException syncFailed) {
            PcpLog.debug("mp4 sync failed: " + syncFailed.getMessage());
        }
        closeQuietly();
    }

    /** Per-sample durations in the movie timescale, derived from capture timestamps. */
    private int[] sampleDurations() {
        int[] durations = new int[frameCount];
        for (int i = 0; i < frameCount - 1; i++) {
            long deltaNanos = samplePts[i + 1] - samplePts[i];
            if (deltaNanos <= 0L) {
                deltaNanos = 1_000_000_000L / nominalFps;
            }
            // Round rather than truncate: truncation accumulates into visible drift over a
            // two-minute clip (30 fps would be stored as 30.01 fps).
            durations[i] = (int) Math.max(1L,
                    (deltaNanos * TIMESCALE + 500_000_000L) / 1_000_000_000L);
        }
        // The last frame has no successor: give it the previous interval.
        durations[frameCount - 1] = frameCount > 1
                ? durations[frameCount - 2]
                : Math.max(1, TIMESCALE / nominalFps);
        return durations;
    }

    private byte[] buildMoov() throws IOException {
        int[] durations = sampleDurations();
        long totalDuration = 0L;
        for (int duration : durations) {
            totalDuration += duration;
        }

        byte[] stbl = box("stbl",
                concat(stsd(), stts(durations), stss(), stsc(), stsz(), stco()));
        byte[] minf = box("minf", concat(vmhd(), dinf(), stbl));
        byte[] mdia = box("mdia", concat(mdhd(totalDuration), hdlr(), minf));
        byte[] trak = box("trak", concat(tkhd(totalDuration), mdia));
        return box("moov", concat(mvhd(totalDuration), trak));
    }

    private byte[] mvhd(long duration) throws IOException {
        Buf b = new Buf();
        b.u32(0);                    // version + flags
        b.u32(0);                    // creation time
        b.u32(0);                    // modification time
        b.u32(TIMESCALE);
        b.u32((int) duration);
        b.u32(0x00010000);           // rate 1.0
        b.u16(0x0100);               // volume 1.0
        b.u16(0);                    // reserved
        b.u32(0);
        b.u32(0);
        identityMatrix(b);
        for (int i = 0; i < 6; i++) {
            b.u32(0);                // pre_defined
        }
        b.u32(2);                    // next track id
        return box("mvhd", b.bytes());
    }

    private byte[] tkhd(long duration) throws IOException {
        Buf b = new Buf();
        b.u32(0x00000007);           // version 0, enabled | in movie | in preview
        b.u32(0);
        b.u32(0);
        b.u32(1);                    // track id
        b.u32(0);                    // reserved
        b.u32((int) duration);
        b.u32(0);
        b.u32(0);
        b.u16(0);                    // layer
        b.u16(0);                    // alternate group
        b.u16(0);                    // volume (video)
        b.u16(0);                    // reserved
        identityMatrix(b);
        b.u32(width << 16);          // 16.16 fixed point
        b.u32(height << 16);
        return box("tkhd", b.bytes());
    }

    private static void identityMatrix(Buf b) throws IOException {
        b.u32(0x00010000);
        b.u32(0);
        b.u32(0);
        b.u32(0);
        b.u32(0x00010000);
        b.u32(0);
        b.u32(0);
        b.u32(0);
        b.u32(0x40000000);
    }

    private byte[] mdhd(long duration) throws IOException {
        Buf b = new Buf();
        b.u32(0);
        b.u32(0);
        b.u32(0);
        b.u32(TIMESCALE);
        b.u32((int) duration);
        b.u16(0x55C4);               // language "und"
        b.u16(0);
        return box("mdhd", b.bytes());
    }

    private byte[] hdlr() throws IOException {
        Buf b = new Buf();
        b.u32(0);
        b.u32(0);                    // pre_defined
        b.fourcc("vide");
        b.u32(0);
        b.u32(0);
        b.u32(0);
        b.raw("PcpClip\u0000".getBytes("US-ASCII"));
        return box("hdlr", b.bytes());
    }

    private byte[] vmhd() throws IOException {
        Buf b = new Buf();
        b.u32(0x00000001);           // version 0, flags 1
        b.u16(0);                    // graphics mode: copy
        b.u16(0);
        b.u16(0);
        b.u16(0);                    // opcolor
        return box("vmhd", b.bytes());
    }

    private byte[] dinf() throws IOException {
        Buf url = new Buf();
        url.u32(0x00000001);         // self contained
        byte[] dref = box("dref", concat(new byte[]{0, 0, 0, 0, 0, 0, 0, 1}, box("url ", url.bytes())));
        return box("dinf", dref);
    }

    private byte[] stsd() throws IOException {
        Buf avcC = new Buf();
        avcC.u8(1);                              // configuration version
        avcC.u8(sps.length > 1 ? sps[1] & 0xFF : 66);   // profile
        avcC.u8(sps.length > 2 ? sps[2] & 0xFF : 0);    // profile compatibility
        avcC.u8(sps.length > 3 ? sps[3] & 0xFF : 30);   // level
        avcC.u8(0xFF);                           // 6 bits reserved + 4-byte NAL length
        avcC.u8(0xE1);                           // 3 bits reserved + one SPS
        avcC.u16(sps.length);
        avcC.raw(sps);
        avcC.u8(1);                              // one PPS
        avcC.u16(pps.length);
        avcC.raw(pps);

        Buf avc1 = new Buf();
        for (int i = 0; i < 6; i++) {
            avc1.u8(0);                          // reserved
        }
        avc1.u16(1);                             // data reference index
        avc1.u16(0);                             // pre_defined
        avc1.u16(0);                             // reserved
        avc1.u32(0);
        avc1.u32(0);
        avc1.u32(0);                             // pre_defined[3]
        avc1.u16(width);
        avc1.u16(height);
        avc1.u32(0x00480000);                    // 72 dpi horizontal
        avc1.u32(0x00480000);                    // 72 dpi vertical
        avc1.u32(0);                             // reserved
        avc1.u16(1);                             // frame count
        byte[] name = new byte[32];
        byte[] label = "PcpClip H.264".getBytes("US-ASCII");
        name[0] = (byte) label.length;
        System.arraycopy(label, 0, name, 1, label.length);
        avc1.raw(name);
        avc1.u16(0x0018);                        // depth
        avc1.u16(0xFFFF);                        // pre_defined
        avc1.raw(box("avcC", avcC.bytes()));

        Buf b = new Buf();
        b.u32(0);                                // version + flags
        b.u32(1);                                // entry count
        b.raw(box("avc1", avc1.bytes()));
        return box("stsd", b.bytes());
    }

    private byte[] stts(int[] durations) throws IOException {
        // Run-length encode equal durations; a steady frame rate collapses to a single entry.
        Buf entries = new Buf();
        int entryCount = 0;
        int runStart = 0;
        for (int i = 1; i <= durations.length; i++) {
            if (i == durations.length || durations[i] != durations[runStart]) {
                entries.u32(i - runStart);
                entries.u32(durations[runStart]);
                entryCount++;
                runStart = i;
            }
        }
        Buf b = new Buf();
        b.u32(0);
        b.u32(entryCount);
        b.raw(entries.bytes());
        return box("stts", b.bytes());
    }

    private byte[] stss() throws IOException {
        Buf b = new Buf();
        b.u32(0);
        b.u32(keyframeCount);
        for (int i = 0; i < keyframeCount; i++) {
            b.u32(keyframeIndexes[i]);
        }
        return box("stss", b.bytes());
    }

    private byte[] stsc() throws IOException {
        // Every sample sits in one contiguous chunk, so one entry describes the whole track.
        Buf b = new Buf();
        b.u32(0);
        b.u32(1);
        b.u32(1);                    // first chunk
        b.u32(frameCount);           // samples per chunk
        b.u32(1);                    // sample description index
        return box("stsc", b.bytes());
    }

    private byte[] stsz() throws IOException {
        Buf b = new Buf();
        b.u32(0);
        b.u32(0);                    // sample_size 0 means "sizes follow"
        b.u32(frameCount);
        for (int i = 0; i < frameCount; i++) {
            b.u32(sampleSizes[i]);
        }
        return box("stsz", b.bytes());
    }

    private byte[] stco() throws IOException {
        Buf b = new Buf();
        b.u32(0);
        b.u32(1);
        b.u32((int) firstSampleOffset);
        return box("stco", b.bytes());
    }

    @Override
    public int frameCount() {
        return frameCount;
    }

    public double durationSeconds() {
        if (firstPtsNanos < 0L || lastPtsNanos <= firstPtsNanos) {
            return frameCount / (double) nominalFps;
        }
        return (lastPtsNanos - firstPtsNanos) / 1_000_000_000.0;
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

    private void writeFourcc(String value) throws IOException {
        out.write(value.charAt(0));
        out.write(value.charAt(1));
        out.write(value.charAt(2));
        out.write(value.charAt(3));
    }

    private static byte[] box(String type, byte[] payload) throws IOException {
        Buf b = new Buf();
        b.u32(8 + payload.length);
        b.fourcc(type);
        b.raw(payload);
        return b.bytes();
    }

    private static byte[] concat(byte[]... parts) {
        int total = 0;
        for (byte[] part : parts) {
            total += part.length;
        }
        byte[] result = new byte[total];
        int at = 0;
        for (byte[] part : parts) {
            System.arraycopy(part, 0, result, at, part.length);
            at += part.length;
        }
        return result;
    }

    /** Big-endian scratch buffer; MP4 boxes are big endian throughout. */
    private static final class Buf {

        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream(256);
        private final DataOutputStream out = new DataOutputStream(bytes);

        void u8(int value) throws IOException {
            out.writeByte(value);
        }

        void u16(int value) throws IOException {
            out.writeShort(value);
        }

        void u32(int value) throws IOException {
            out.writeInt(value);
        }

        void fourcc(String value) throws IOException {
            out.writeByte(value.charAt(0));
            out.writeByte(value.charAt(1));
            out.writeByte(value.charAt(2));
            out.writeByte(value.charAt(3));
        }

        void raw(byte[] value) throws IOException {
            out.write(value);
        }

        byte[] bytes() throws IOException {
            out.flush();
            return bytes.toByteArray();
        }
    }
}
