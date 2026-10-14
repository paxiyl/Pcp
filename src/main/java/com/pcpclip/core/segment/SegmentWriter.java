package com.pcpclip.core.segment;

import com.pcpclip.core.codec.PacketSink;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.util.PcpLog;

import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Writes one segment file. Used from a single encoder worker thread, which owns the segment.
 */
public final class SegmentWriter implements PacketSink {

    private final SegmentHandle handle;
    private final FileOutputStream fileStream;
    private final DataOutputStream out;
    private boolean firstFrame = true;
    private boolean closed;

    public SegmentWriter(File file, long index, SegmentCodec codec, int width, int height,
                         int targetFps, long startPtsNanos) throws IOException {
        this.handle = new SegmentHandle(file, index, codec, width, height, targetFps,
                System.currentTimeMillis(), startPtsNanos);
        this.fileStream = new FileOutputStream(file);
        this.out = new DataOutputStream(new BufferedOutputStream(fileStream, 64 * 1024));
        out.write(SegmentFormat.MAGIC);
        out.writeInt(SegmentFormat.VERSION);
        out.writeInt(codec.id());
        out.writeInt(width);
        out.writeInt(height);
        out.writeInt(targetFps);
        out.writeLong(handle.startEpochMillis);
        out.writeLong(startPtsNanos);
    }

    public SegmentHandle handle() {
        return handle;
    }

    @Override
    public void packet(byte[] data, int offset, int length, long ptsNanos, boolean keyframe)
            throws IOException {
        if (closed) {
            return;
        }
        out.writeInt(length);
        out.writeLong(ptsNanos);
        out.writeByte(keyframe ? SegmentFormat.FLAG_KEYFRAME : 0);
        out.write(data, offset, length);
        handle.recordFrame(ptsNanos, length, firstFrame);
        firstFrame = false;
    }

    /**
     * Writes the trailer and closes the file.
     *
     * @param durable when true the bytes are pushed to storage, so a crash or a killed app still
     *                leaves a readable segment behind
     */
    public SegmentHandle finish(boolean durable) {
        if (closed) {
            return handle;
        }
        closed = true;
        try {
            out.writeInt(SegmentFormat.TRAILER_MARKER);
            out.writeInt(handle.frameCount());
            out.writeLong(handle.endPtsNanos());
            out.flush();
            if (durable) {
                try {
                    fileStream.getFD().sync();
                } catch (IOException syncFailed) {
                    // Not fatal: the segment is still complete in the page cache.
                    PcpLog.debug("segment sync failed: " + syncFailed.getMessage());
                }
            }
        } catch (IOException error) {
            PcpLog.warn("Could not finalise " + handle.file.getName(), error);
        } finally {
            try {
                out.close();
            } catch (IOException ignored) {
                // nothing useful to do
            }
        }
        handle.markFinished(handle.file.length());
        return handle;
    }

    /** Abandons the segment and removes the partial file. */
    public void abort() {
        if (!closed) {
            closed = true;
            try {
                out.close();
            } catch (IOException ignored) {
                // nothing useful to do
            }
        }
        if (!handle.delete()) {
            PcpLog.debug("could not delete aborted segment " + handle.file);
        }
    }
}
