package com.pcpclip.core.segment;

import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.io.FilenameFilter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;

/**
 * The rolling buffer: an ordered set of encoded segments on disk, bounded by both duration and
 * bytes.
 *
 * <p>Pruning happens whenever a segment is added, so the buffer cannot creep past its configured
 * size however long the session runs. Two things stop a segment being pruned: a retention mark
 * (manual recording keeps everything from the moment the user pressed record) and an export lock
 * (a clip currently being written out).
 */
public final class SegmentStore {

    private final File directory;
    private final Deque<SegmentHandle> segments = new ArrayDeque<SegmentHandle>();

    private long bufferNanos;
    private long maxBytes;
    /** When set, nothing at or after this timestamp is pruned. */
    private long retainFromPtsNanos = Long.MAX_VALUE;
    private long totalBytes;
    private long droppedSegments;

    public SegmentStore(File directory, long bufferNanos, long maxBytes) {
        this.directory = directory;
        this.bufferNanos = bufferNanos;
        this.maxBytes = maxBytes;
        if (!directory.isDirectory() && !directory.mkdirs()) {
            PcpLog.warn("Could not create the segment cache folder " + directory);
        }
    }

    public File directory() {
        return directory;
    }

    public synchronized void setBufferNanos(long nanos) {
        this.bufferNanos = Math.max(0L, nanos);
        prune();
    }

    public synchronized void setMaxBytes(long bytes) {
        this.maxBytes = Math.max(0L, bytes);
        prune();
    }

    /** Keeps everything from this timestamp on, for manual recording. */
    public synchronized void retainFrom(long ptsNanos) {
        this.retainFromPtsNanos = ptsNanos;
    }

    public synchronized void clearRetention() {
        this.retainFromPtsNanos = Long.MAX_VALUE;
        prune();
    }

    public synchronized boolean hasRetention() {
        return retainFromPtsNanos != Long.MAX_VALUE;
    }

    public synchronized long retentionStart() {
        return retainFromPtsNanos;
    }

    public synchronized void add(SegmentHandle handle) {
        if (handle == null || handle.frameCount() == 0) {
            return;
        }
        segments.addLast(handle);
        totalBytes += handle.bytes();
        prune();
    }

    /** Drops the oldest segments until the buffer fits both limits again. */
    private void prune() {
        while (!segments.isEmpty()) {
            SegmentHandle oldest = segments.peekFirst();
            SegmentHandle newest = segments.peekLast();
            boolean tooLong = bufferNanos > 0L
                    && newest.endPtsNanos() - oldest.startPtsNanos() > bufferNanos + oldest.durationNanos();
            boolean tooBig = maxBytes > 0L && totalBytes > maxBytes;
            if (!tooLong && !tooBig) {
                return;
            }
            if (oldest.locks > 0) {
                // An export is reading it; try again after that finishes.
                return;
            }
            if (oldest.endPtsNanos() >= retainFromPtsNanos) {
                // Inside a manual recording: the user asked for these frames, keep them. The byte
                // cap is enforced by the recorder, which stops recording instead of losing the
                // middle of a clip.
                return;
            }
            segments.removeFirst();
            totalBytes -= oldest.bytes();
            droppedSegments++;
            if (!oldest.delete()) {
                PcpLog.debug("could not delete pruned segment " + oldest.file);
            }
        }
    }

    public synchronized int count() {
        return segments.size();
    }

    public synchronized long totalBytes() {
        return totalBytes;
    }

    public synchronized long droppedSegments() {
        return droppedSegments;
    }

    /** Timespan currently held, in nanoseconds. */
    public synchronized long coveredNanos() {
        if (segments.isEmpty()) {
            return 0L;
        }
        return segments.peekLast().endPtsNanos() - segments.peekFirst().startPtsNanos();
    }

    public synchronized long oldestPts() {
        return segments.isEmpty() ? 0L : segments.peekFirst().startPtsNanos();
    }

    public synchronized long newestPts() {
        return segments.isEmpty() ? 0L : segments.peekLast().endPtsNanos();
    }

    /**
     * Picks the segments needed to cover the last {@code durationNanos} and locks them.
     *
     * <p>The caller must pass the result to {@link #release(Selection)} when the export finishes,
     * whether it succeeded or not.
     */
    public synchronized Selection selectLast(long durationNanos) {
        if (segments.isEmpty()) {
            return Selection.empty();
        }
        long end = segments.peekLast().endPtsNanos();
        long from = Math.max(0L, end - Math.max(0L, durationNanos));
        return selectRange(from, Long.MAX_VALUE);
    }

    /** Picks every segment overlapping the timestamp range and locks them. */
    public synchronized Selection selectRange(long fromPtsNanos, long toPtsNanos) {
        List<SegmentHandle> chosen = new ArrayList<SegmentHandle>();
        for (SegmentHandle handle : segments) {
            if (handle.endPtsNanos() < fromPtsNanos || handle.startPtsNanos() > toPtsNanos) {
                continue;
            }
            chosen.add(handle);
        }
        if (chosen.isEmpty()) {
            return Selection.empty();
        }
        for (SegmentHandle handle : chosen) {
            handle.locks++;
        }
        return new Selection(chosen, fromPtsNanos, toPtsNanos);
    }

    public synchronized void release(Selection selection) {
        if (selection == null) {
            return;
        }
        for (SegmentHandle handle : selection.segments) {
            if (handle.locks > 0) {
                handle.locks--;
            }
        }
        prune();
    }

    /** Deletes every segment. Used when the buffer is switched off or a session ends. */
    public synchronized void clear() {
        for (Iterator<SegmentHandle> it = segments.iterator(); it.hasNext(); ) {
            SegmentHandle handle = it.next();
            if (handle.locks > 0) {
                continue;
            }
            it.remove();
            totalBytes -= handle.bytes();
            if (!handle.delete()) {
                PcpLog.debug("could not delete segment " + handle.file);
            }
        }
        retainFromPtsNanos = Long.MAX_VALUE;
    }

    /**
     * Finds segment files left behind by a previous session, newest first.
     *
     * <p>A crash, a killed app or a device running out of battery leaves finished segments in the
     * cache; the clip-history screen offers them for recovery instead of silently deleting them.
     */
    public static List<SegmentHandle> findOrphans(File directory) {
        List<SegmentHandle> found = new ArrayList<SegmentHandle>();
        if (directory == null || !directory.isDirectory()) {
            return found;
        }
        File[] files = directory.listFiles(new FilenameFilter() {
            @Override
            public boolean accept(File dir, String name) {
                return name.endsWith(SegmentFormat.EXTENSION);
            }
        });
        if (files == null) {
            return found;
        }
        Arrays.sort(files, new Comparator<File>() {
            @Override
            public int compare(File a, File b) {
                return a.getName().compareTo(b.getName());
            }
        });
        long index = 0L;
        for (File file : files) {
            SegmentHandle handle = SegmentReader.scan(file, index++);
            if (handle != null) {
                found.add(handle);
            } else if (!file.delete()) {
                PcpLog.debug("left an unreadable segment in place: " + file);
            }
        }
        return found;
    }

    /** A locked set of segments plus the timestamp window the export should trim to. */
    public static final class Selection {

        public final List<SegmentHandle> segments;
        public final long fromPtsNanos;
        public final long toPtsNanos;

        Selection(List<SegmentHandle> segments, long fromPtsNanos, long toPtsNanos) {
            this.segments = segments;
            this.fromPtsNanos = fromPtsNanos;
            this.toPtsNanos = toPtsNanos;
        }

        static Selection empty() {
            return new Selection(new ArrayList<SegmentHandle>(), 0L, 0L);
        }

        public boolean isEmpty() {
            return segments.isEmpty();
        }

        public long bytes() {
            long total = 0L;
            for (SegmentHandle handle : segments) {
                total += handle.bytes();
            }
            return total;
        }

        public int frames() {
            int total = 0;
            for (SegmentHandle handle : segments) {
                total += handle.frameCount();
            }
            return total;
        }
    }
}
