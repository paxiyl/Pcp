package com.pcpclip.test;

import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentReader;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.segment.SegmentWriter;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.List;
import java.util.Random;

import static com.pcpclip.test.TestSupport.check;
import static com.pcpclip.test.TestSupport.checkEquals;
import static com.pcpclip.test.TestSupport.note;
import static com.pcpclip.test.TestSupport.startTest;

/** The rolling buffer: must stay bounded, must survive truncation, must not lose locked data. */
final class SegmentTests {

    private SegmentTests() {
    }

    private static final long SECOND = 1_000_000_000L;

    static void run() throws IOException {
        File directory = TestSupport.tempDirectory("pcpclip-segments");
        try {
            startTest("segments: write and read back");
            File file = new File(directory, "seg-000001.pcpseg");
            SegmentWriter writer = new SegmentWriter(file, 1L, SegmentCodec.MJPEG, 640, 360, 30, 0L);
            Random random = new Random(7);
            byte[] payload = new byte[4096];
            for (int i = 0; i < 30; i++) {
                random.nextBytes(payload);
                writer.packet(payload, 0, payload.length, i * (SECOND / 30), i % 10 == 0);
            }
            SegmentHandle handle = writer.finish(false);
            checkEquals(30, handle.frameCount(), "all frames recorded");
            check(handle.finished(), "segment marked finished");
            check(handle.bytes() > 30 * 4096, "byte count includes the payloads");

            SegmentReader reader = new SegmentReader(file);
            int read = 0;
            int keyframes = 0;
            long lastPts = -1L;
            while (reader.next()) {
                check(reader.payloadLength() == 4096, "payload length preserved");
                check(reader.ptsNanos() > lastPts, "timestamps increase");
                lastPts = reader.ptsNanos();
                if (reader.keyframe()) {
                    keyframes++;
                }
                read++;
            }
            reader.close();
            checkEquals(30, read, "every frame read back");
            checkEquals(3, keyframes, "keyframe flags preserved");

            startTest("segments: a truncated file still yields its complete frames");
            File truncated = new File(directory, "seg-000002.pcpseg");
            SegmentWriter writer2 = new SegmentWriter(truncated, 2L, SegmentCodec.H264, 640, 360, 30, 0L);
            for (int i = 0; i < 20; i++) {
                writer2.packet(payload, 0, 2048, i * (SECOND / 30), i == 0);
            }
            writer2.finish(false);
            long fullLength = truncated.length();
            RandomAccessFile chop = new RandomAccessFile(truncated, "rw");
            chop.setLength(fullLength - 3000L);         // cut mid-record, as a crash would
            chop.close();

            SegmentReader partial = new SegmentReader(truncated);
            int survived = 0;
            while (partial.next()) {
                survived++;
            }
            partial.close();
            check(survived > 10 && survived < 20,
                    "frames before the damage are readable (" + survived + " of 20)");

            SegmentHandle scanned = SegmentReader.scan(truncated, 2L);
            check(scanned != null, "a damaged segment can still be scanned");
            if (scanned != null) {
                checkEquals(survived, scanned.frameCount(), "scan agrees with the read");
            }

            startTest("segments: a file that is not a segment is rejected cleanly");
            File alien = new File(directory, "alien.pcpseg");
            RandomAccessFile junk = new RandomAccessFile(alien, "rw");
            junk.write("this is not a segment at all".getBytes("US-ASCII"));
            junk.close();
            check(SegmentReader.scan(alien, 0L) == null, "scan returns nothing for a foreign file");
            boolean threw = false;
            try {
                new SegmentReader(alien).close();
            } catch (IOException expected) {
                threw = true;
            }
            check(threw, "opening a foreign file throws rather than returning garbage");

            startTest("store: the buffer stays bounded by duration");
            File storeDirectory = new File(directory, "store");
            SegmentStore store = new SegmentStore(storeDirectory, 10L * SECOND, 0L);
            for (int i = 0; i < 40; i++) {
                store.add(makeSegment(storeDirectory, i, i * 2L * SECOND, 2L * SECOND, 60));
            }
            note("store holds " + store.count() + " segments, "
                    + store.coveredNanos() / SECOND + "s, " + store.totalBytes() + " bytes");
            check(store.coveredNanos() <= 14L * SECOND,
                    "buffer does not grow past its limit plus one segment");
            check(store.count() <= 8, "old segments were pruned");
            check(store.droppedSegments() > 25, "pruning really happened");
            File[] remaining = storeDirectory.listFiles();
            check(remaining != null && remaining.length == store.count(),
                    "pruned files were deleted from disk, not just forgotten");

            startTest("store: the buffer stays bounded by bytes");
            File byteDirectory = new File(directory, "bytes");
            SegmentStore byteStore = new SegmentStore(byteDirectory, 600L * SECOND, 200000L);
            for (int i = 0; i < 30; i++) {
                byteStore.add(makeSegment(byteDirectory, i, i * SECOND, SECOND, 100));
            }
            check(byteStore.totalBytes() <= 260000L,
                    "byte cap respected (" + byteStore.totalBytes() + " bytes)");

            startTest("store: a locked selection is never pruned away");
            File lockDirectory = new File(directory, "locks");
            SegmentStore lockStore = new SegmentStore(lockDirectory, 4L * SECOND, 0L);
            for (int i = 0; i < 4; i++) {
                lockStore.add(makeSegment(lockDirectory, i, i * SECOND, SECOND, 10));
            }
            SegmentStore.Selection selection = lockStore.selectLast(4L * SECOND);
            int lockedCount = selection.segments.size();
            check(lockedCount > 0, "selection found segments");
            File oldest = selection.segments.get(0).file;
            for (int i = 4; i < 20; i++) {
                lockStore.add(makeSegment(lockDirectory, i, i * SECOND, SECOND, 10));
            }
            check(oldest.exists(), "the segment being exported is still on disk");
            lockStore.release(selection);
            check(!oldest.exists(), "and is pruned once the export releases it");

            startTest("store: retention keeps a manual recording intact");
            File retainDirectory = new File(directory, "retain");
            SegmentStore retainStore = new SegmentStore(retainDirectory, 2L * SECOND, 0L);
            retainStore.retainFrom(0L);
            for (int i = 0; i < 20; i++) {
                retainStore.add(makeSegment(retainDirectory, i, i * SECOND, SECOND, 10));
            }
            checkEquals(20, retainStore.count(), "nothing inside the recording was pruned");
            retainStore.clearRetention();
            check(retainStore.count() < 20, "and pruning resumes once recording stops");

            startTest("store: orphan discovery for crash recovery");
            File orphanDirectory = new File(directory, "orphans");
            SegmentStore orphanStore = new SegmentStore(orphanDirectory, 0L, 0L);
            for (int i = 0; i < 3; i++) {
                orphanStore.add(makeSegment(orphanDirectory, i, i * SECOND, SECOND, 10));
            }
            List<SegmentHandle> orphans = SegmentStore.findOrphans(orphanDirectory);
            checkEquals(3, orphans.size(), "all three segments were found");
            check(orphans.get(0).frameCount() == 10, "orphan frame counts were recovered");
            checkEquals(0L, orphans.get(0).startPtsNanos(), "orphans keep their timeline");
        } finally {
            TestSupport.deleteTree(directory);
        }
    }

    /** Writes a real segment file so pruning exercises real deletion. */
    private static SegmentHandle makeSegment(File directory, int index, long startPts,
                                             long duration, int frames) throws IOException {
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("could not create " + directory);
        }
        File file = new File(directory, String.format("seg-%06d.pcpseg", index));
        SegmentWriter writer = new SegmentWriter(file, index, SegmentCodec.MJPEG, 320, 180, 30, startPts);
        byte[] payload = new byte[1024];
        for (int i = 0; i < frames; i++) {
            long pts = startPts + (duration * i) / Math.max(1, frames);
            writer.packet(payload, 0, payload.length, pts, i == 0);
        }
        return writer.finish(false);
    }
}
