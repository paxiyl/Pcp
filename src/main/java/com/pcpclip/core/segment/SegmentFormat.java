package com.pcpclip.core.segment;

/**
 * On-disk format for a buffer segment.
 *
 * <p>A segment is a flat list of already-encoded frames with their timestamps. Keeping the
 * rolling buffer as compressed segments rather than raw frames is what makes a two-minute buffer
 * affordable: 120 seconds of 720p H.264 is a few tens of megabytes on disk instead of gigabytes
 * of pixels in RAM.
 *
 * <p>The format is append-only and tolerates truncation: a reader stops at the first short or
 * damaged record, which is what makes a segment from a crashed session still usable.
 *
 * <pre>
 * header   "PCPSEG" magic, version, codec id, width, height, target fps,
 *          wall-clock start, first timestamp
 * records  [int length][long ptsNanos][byte flags][length bytes payload]
 * trailer  [int -1][int frameCount][long lastPtsNanos]
 * </pre>
 */
public final class SegmentFormat {

    public static final byte[] MAGIC = {'P', 'C', 'P', 'S', 'E', 'G'};
    public static final int VERSION = 1;
    public static final int TRAILER_MARKER = -1;
    public static final byte FLAG_KEYFRAME = 1;
    public static final String EXTENSION = ".pcpseg";

    /** Longest payload a reader will accept, as a guard against a corrupt length field. */
    public static final int MAX_PAYLOAD_BYTES = 64 * 1024 * 1024;

    private SegmentFormat() {
    }
}
