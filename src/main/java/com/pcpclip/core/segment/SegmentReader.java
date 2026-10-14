package com.pcpclip.core.segment;

import com.pcpclip.core.codec.SegmentCodec;

import java.io.BufferedInputStream;
import java.io.Closeable;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Arrays;

/**
 * Reads a segment back, frame by frame.
 *
 * <p>Tolerant by design: a segment whose trailer is missing, or whose last record was cut short
 * by a crash, still yields every complete frame before the damage.
 */
public final class SegmentReader implements Closeable {

    private final DataInputStream in;
    private final SegmentCodec codec;
    private final int width;
    private final int height;
    private final int targetFps;
    private final long startEpochMillis;
    private final long startPtsNanos;

    private byte[] payload = new byte[64 * 1024];
    private int payloadLength;
    private long ptsNanos;
    private boolean keyframe;
    private boolean exhausted;

    public SegmentReader(File file) throws IOException {
        this.in = new DataInputStream(new BufferedInputStream(new FileInputStream(file), 64 * 1024));
        byte[] magic = new byte[SegmentFormat.MAGIC.length];
        in.readFully(magic);
        if (!Arrays.equals(magic, SegmentFormat.MAGIC)) {
            closeQuietly();
            throw new IOException(file.getName() + " is not a PcpClip segment");
        }
        int version = in.readInt();
        if (version != SegmentFormat.VERSION) {
            closeQuietly();
            throw new IOException(file.getName() + " has unsupported segment version " + version);
        }
        int codecId = in.readInt();
        SegmentCodec found = SegmentCodec.byId(codecId);
        if (found == null) {
            closeQuietly();
            throw new IOException(file.getName() + " uses unknown codec id " + codecId);
        }
        this.codec = found;
        this.width = in.readInt();
        this.height = in.readInt();
        this.targetFps = in.readInt();
        this.startEpochMillis = in.readLong();
        this.startPtsNanos = in.readLong();
    }

    public SegmentCodec codec() {
        return codec;
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public int targetFps() {
        return targetFps;
    }

    public long startEpochMillis() {
        return startEpochMillis;
    }

    public long startPtsNanos() {
        return startPtsNanos;
    }

    /** Advances to the next frame; false once the segment is used up or damaged. */
    public boolean next() throws IOException {
        if (exhausted) {
            return false;
        }
        int length;
        try {
            length = in.readInt();
        } catch (EOFException endOfFile) {
            exhausted = true;
            return false;
        }
        if (length == SegmentFormat.TRAILER_MARKER) {
            exhausted = true;
            return false;
        }
        if (length < 0 || length > SegmentFormat.MAX_PAYLOAD_BYTES) {
            exhausted = true;
            return false;
        }
        try {
            ptsNanos = in.readLong();
            keyframe = (in.readByte() & SegmentFormat.FLAG_KEYFRAME) != 0;
            if (payload.length < length) {
                payload = new byte[length];
            }
            in.readFully(payload, 0, length);
        } catch (EOFException truncated) {
            // The writing process died mid-record; everything before this point is still good.
            exhausted = true;
            return false;
        }
        payloadLength = length;
        return true;
    }

    /** Frame payload. Valid until the next {@link #next()} call. */
    public byte[] payload() {
        return payload;
    }

    public int payloadLength() {
        return payloadLength;
    }

    public long ptsNanos() {
        return ptsNanos;
    }

    public boolean keyframe() {
        return keyframe;
    }

    @Override
    public void close() {
        closeQuietly();
    }

    private void closeQuietly() {
        try {
            in.close();
        } catch (IOException ignored) {
            // nothing useful to do
        }
    }

    /** Reads just the counters, for crash recovery and for the clip-history screen. */
    public static SegmentHandle scan(File file, long index) {
        SegmentReader reader = null;
        try {
            reader = new SegmentReader(file);
            long first = Long.MIN_VALUE;
            long last = 0L;
            int frames = 0;
            while (reader.next()) {
                if (first == Long.MIN_VALUE) {
                    first = reader.ptsNanos();
                }
                last = reader.ptsNanos();
                frames++;
            }
            if (frames == 0) {
                return null;
            }
            SegmentHandle handle = new SegmentHandle(file, index, reader.codec(), reader.width(),
                    reader.height(), reader.targetFps(), reader.startEpochMillis(), first);
            handle.restore(first, last, frames, file.length());
            return handle;
        } catch (IOException error) {
            return null;
        } finally {
            if (reader != null) {
                reader.close();
            }
        }
    }
}
