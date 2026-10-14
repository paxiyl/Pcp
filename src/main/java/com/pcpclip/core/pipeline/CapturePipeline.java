package com.pcpclip.core.pipeline;

import com.pcpclip.core.codec.EncoderCapabilities;
import com.pcpclip.core.codec.EncoderFactory;
import com.pcpclip.core.codec.EncoderSpec;
import com.pcpclip.core.codec.EncoderUnavailableException;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.codec.VideoEncoder;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.config.EncoderPreference;
import com.pcpclip.core.frame.FramePool;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.perf.LoadMonitor;
import com.pcpclip.core.segment.SegmentFormat;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.segment.SegmentWriter;
import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;

/**
 * The asynchronous capture pipeline.
 *
 * <p>Shape of it, from the render thread outwards:
 *
 * <pre>
 *  render thread  --offer()-->  inbox (bounded)  -->  dispatcher thread
 *                                                          |
 *                                        rotates segments, one task per segment
 *                                                          v
 *                                              worker pool (1-3 threads)
 *                                                          |
 *                                           encode -> segment file on disk
 * </pre>
 *
 * <p>The render thread never encodes, never writes a file, never allocates and never blocks: it
 * takes a pooled buffer, hands it over and returns. Everything downstream is bounded, so when the
 * encoder cannot keep up the only consequence is dropped captures, counted in
 * {@link PipelineStats} and shown to the user.
 */
public final class CapturePipeline {

    /** How long the dispatcher will wait for a slow segment before giving up on a frame. */
    private static final long SUBMIT_TIMEOUT_MILLIS = 250L;

    private final ClipConfig config;
    private final SegmentStore store;
    private final FramePool pool;
    private final PipelineStats stats = new PipelineStats();
    private final LoadMonitor loadMonitor;
    private final OutputGeometry geometry;
    /**
     * Geometry handed to each frame. With the GPU blit path the driver has already cropped and
     * scaled, so frames carry an identity transform and the converter only flips rows; on the
     * software fallback the frames are raw framebuffer reads and carry the real transform.
     */
    private final OutputGeometry frameGeometry;
    private final boolean preScaled;
    private final EncoderPreference backend;
    private final SegmentCodec codec;
    private final String backendName;
    private final long segmentNanos;
    private final long frameIntervalNanos;
    private final int workerCount;

    private final BlockingQueue<VideoFrame> inbox;
    private final ExecutorService workers;
    private final Thread dispatcher;
    private final Listener listener;

    private final long startNanos;
    private volatile long pausedNanos;
    private volatile long pauseStartedNanos = -1L;
    private volatile boolean running = true;
    private volatile boolean fatal;
    private volatile String fatalMessage = "";

    private volatile SegmentTask currentTask;
    private long nextSegmentIndex;
    private long currentSegmentStartPts;
    private long currentSegmentStartedNanos;
    /** Last timestamp accepted into the pipeline. Written only by the render thread. */
    private long lastAcceptedPts = Long.MIN_VALUE;

    /** Notified when the pipeline hits a condition the user should hear about. */
    public interface Listener {
        void onPipelineError(String message);

        void onSegmentStored(SegmentHandle handle);
    }

    private CapturePipeline(ClipConfig config, SegmentStore store, OutputGeometry geometry,
                            boolean preScaled, EncoderPreference backend, SegmentCodec codec,
                            String backendName, FramePool pool, LoadMonitor loadMonitor,
                            Listener listener) {
        this.config = config;
        this.store = store;
        this.geometry = geometry;
        this.preScaled = preScaled;
        this.frameGeometry = preScaled
                ? OutputGeometry.identity(geometry.outWidth, geometry.outHeight) : geometry;
        this.backend = backend;
        this.codec = codec;
        this.backendName = backendName;
        this.pool = pool;
        this.loadMonitor = loadMonitor;
        this.listener = listener;
        this.segmentNanos = Math.max(500L, config.segmentMillis) * 1_000_000L;
        this.frameIntervalNanos = 1_000_000_000L / Math.max(1, config.targetFps);
        this.workerCount = config.effectiveEncoderThreads();
        this.inbox = new ArrayBlockingQueue<VideoFrame>(Math.max(2, pool.capacity()));
        this.startNanos = System.nanoTime();

        this.workers = Executors.newFixedThreadPool(workerCount, new ThreadFactory() {
            private int created;

            @Override
            public Thread newThread(Runnable task) {
                Thread thread = new Thread(task, "PcpClip-encoder-" + (++created));
                thread.setDaemon(true);
                // Below normal: the game's own threads must always win a contested core.
                thread.setPriority(Thread.MIN_PRIORITY + 1);
                return thread;
            }
        });

        this.dispatcher = new Thread(new Runnable() {
            @Override
            public void run() {
                dispatchLoop();
            }
        }, "PcpClip-dispatch");
        this.dispatcher.setDaemon(true);
        this.dispatcher.setPriority(Thread.NORM_PRIORITY - 1);
    }

    /**
     * Builds a pipeline, choosing an encoder backend that this runtime can actually provide.
     *
     * @param preScaled true when the capture layer hands over frames the GPU has already cropped
     *                  and scaled to the output size
     * @throws EncoderUnavailableException when nothing can encode, so the caller can tell the user
     *                                     rather than failing silently
     */
    public static CapturePipeline start(ClipConfig config, SegmentStore store,
                                        OutputGeometry geometry, boolean preScaled,
                                        LoadMonitor loadMonitor, Listener listener)
            throws EncoderUnavailableException {
        EncoderSpec spec = EncoderSpec.from(config, geometry.outWidth, geometry.outHeight);
        int workers = config.effectiveEncoderThreads();
        EncoderPreference resolved = EncoderFactory.resolve(spec, workers);

        // Build one encoder up front: it is the only way to find out whether the backend really
        // works here, and failing now is much kinder than failing per segment later.
        VideoEncoder probe = EncoderFactory.create(spec, resolved);
        SegmentCodec codec = probe.codec();
        String backendName = probe.name();
        probe.close();

        long frameBytes = preScaled
                ? (long) geometry.outWidth * geometry.outHeight * 4L
                : (long) geometry.srcWidth * geometry.srcHeight * 4L;
        FramePool pool = new FramePool((int) Math.min(Integer.MAX_VALUE, frameBytes),
                (long) config.captureMemoryBudgetMb * 1024L * 1024L);

        CapturePipeline pipeline = new CapturePipeline(config, store, geometry, preScaled, resolved,
                codec, backendName, pool, loadMonitor, listener);
        pipeline.dispatcher.start();
        PcpLog.info(String.format(Locale.ROOT,
                "capture pipeline up: %s, %dx%d target %d fps, %s scaling, %d worker(s), "
                        + "%d pooled buffers (%d MB), %d ms segments",
                backendName, geometry.outWidth, geometry.outHeight, config.targetFps,
                preScaled ? "GPU" : "software", workers, pool.capacity(),
                pool.budgetBytes() / 1048576L, config.segmentMillis));
        return pipeline;
    }

    public PipelineStats stats() {
        return stats;
    }

    public OutputGeometry geometry() {
        return geometry;
    }

    public SegmentCodec codec() {
        return codec;
    }

    public EncoderPreference backend() {
        return backend;
    }

    public String backendName() {
        return backendName;
    }

    public FramePool pool() {
        return pool;
    }

    public boolean isFatal() {
        return fatal;
    }

    public String fatalMessage() {
        return fatalMessage;
    }

    /** Session timestamp for right now, with paused intervals removed. */
    public long nowPts() {
        long pauseStart = pauseStartedNanos;
        long elapsed = (pauseStart >= 0L ? pauseStart : System.nanoTime()) - startNanos;
        return elapsed - pausedNanos;
    }

    public boolean paused() {
        return pauseStartedNanos >= 0L;
    }

    public void pause() {
        if (pauseStartedNanos < 0L) {
            pauseStartedNanos = System.nanoTime();
        }
    }

    public void resume() {
        long pauseStart = pauseStartedNanos;
        if (pauseStart >= 0L) {
            pausedNanos += System.nanoTime() - pauseStart;
            pauseStartedNanos = -1L;
        }
    }

    /**
     * Takes a pooled buffer for the render thread to read pixels into.
     *
     * @return null when every buffer is busy, meaning this frame should be skipped
     */
    public VideoFrame acquireFrame() {
        if (!running || fatal || paused()) {
            return null;
        }
        stats.captureAttempt();
        long pts = nowPts();
        VideoFrame frame = pool.acquire(captureWidth(), captureHeight(), frameGeometry, pts,
                stats.captureAttemptCount());
        if (frame == null) {
            stats.dropNoBuffer();
        }
        return frame;
    }

    /** Width of the pixel data the capture layer will produce. */
    public int captureWidth() {
        return preScaled ? geometry.outWidth : geometry.srcWidth;
    }

    public int captureHeight() {
        return preScaled ? geometry.outHeight : geometry.srcHeight;
    }

    public boolean preScaled() {
        return preScaled;
    }

    /**
     * Hands a filled frame to the pipeline. Returns false when the frame was dropped, in which
     * case it has already been released.
     */
    public boolean offer(VideoFrame frame, long readbackCostNanos) {
        if (frame == null) {
            return false;
        }
        if (!running || fatal) {
            frame.release();
            return false;
        }
        // Timestamps must move forward. Everything downstream depends on it: segments rotate on
        // elapsed presentation time, exports select and trim by it, and a container stores it as
        // frame duration. A capture path that hands over a repeated timestamp - which an
        // asynchronous readback can do if its bookkeeping slips - would otherwise stall segment
        // rotation and collapse a saved clip to a single frame. Nudging the timestamp forward
        // keeps the clip usable, and the counter makes the fault visible instead of silent.
        long pts = frame.ptsNanos();
        if (pts <= lastAcceptedPts) {
            stats.timestampAnomaly();
            // Step on by one frame interval rather than a token amount: the synthetic timeline
            // then runs at roughly the rate being captured, so segments still rotate on time and
            // the clip still plays at a sane speed.
            pts = lastAcceptedPts + frameIntervalNanos;
            frame.setPtsNanos(pts);
        }
        lastAcceptedPts = pts;

        if (!inbox.offer(frame)) {
            stats.dropQueueFull();
            frame.release();
            return false;
        }
        stats.captured(pts, readbackCostNanos);
        return true;
    }

    public int backlog() {
        SegmentTask task = currentTask;
        return inbox.size() + (task != null ? task.backlog() : 0);
    }

    private void dispatchLoop() {
        try {
            while (running) {
                VideoFrame frame = inbox.poll(200L, TimeUnit.MILLISECONDS);
                if (frame == null) {
                    // Idle: close off a segment that has been open too long so the rolling buffer
                    // always has a recent, complete tail to clip from.
                    SegmentTask task = currentTask;
                    if (task != null && nowPts() - currentSegmentStartPts > segmentNanos * 2L) {
                        rotateSegment(nowPts());
                    }
                    continue;
                }
                dispatch(frame);
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (Throwable error) {
            failFatally("Capture dispatcher stopped: " + error, error);
        } finally {
            SegmentTask task = currentTask;
            if (task != null) {
                task.seal();
            }
            VideoFrame pending;
            while ((pending = inbox.poll()) != null) {
                pending.release();
            }
        }
    }

    private void dispatch(VideoFrame frame) throws InterruptedException {
        SegmentTask task = currentTask;
        boolean dueByTimestamp = frame.ptsNanos() - currentSegmentStartPts >= segmentNanos;
        // A wall-clock backstop as well, so that even a capture path with confused timestamps
        // still closes segments and keeps the rolling buffer clippable. The timestamp test
        // normally fires first; this only matters when something has gone wrong.
        boolean dueByClock = currentSegmentStartedNanos > 0L
                && System.nanoTime() - currentSegmentStartedNanos >= segmentNanos * 2L;
        if (task == null || dueByTimestamp || dueByClock) {
            task = rotateSegment(frame.ptsNanos());
        }
        if (task == null) {
            frame.release();
            return;
        }
        if (!task.submit(frame, SUBMIT_TIMEOUT_MILLIS)) {
            // The segment's worker is badly behind. Dropping here keeps memory bounded; the
            // alternative is an unbounded backlog and eventually an out-of-memory kill.
            stats.dropQueueFull();
            frame.release();
        }
    }

    /** Seals the current segment and opens the next one. */
    private SegmentTask rotateSegment(long ptsNanos) {
        SegmentTask previous = currentTask;
        if (previous != null) {
            previous.seal();
        }
        if (fatal) {
            currentTask = null;
            return null;
        }

        int quality = loadMonitor.effectiveJpegQuality(config.jpegQuality);
        int quantiser = loadMonitor.effectiveH264Qp(config.h264Qp);
        EncoderSpec spec = new EncoderSpec(geometry.outWidth, geometry.outHeight, config.targetFps,
                config.bitrateKbps, quality, quantiser, backend);

        VideoEncoder encoder = null;
        SegmentWriter writer = null;
        try {
            encoder = EncoderFactory.create(spec, backend);
            File file = new File(store.directory(), String.format(Locale.ROOT, "seg-%06d%s",
                    nextSegmentIndex, SegmentFormat.EXTENSION));
            writer = new SegmentWriter(file, nextSegmentIndex, codec, geometry.outWidth,
                    geometry.outHeight, config.targetFps, ptsNanos);
            SegmentTask task = new SegmentTask(encoder, writer, pool.capacity(), stats,
                    new SegmentTask.Listener() {
                        @Override
                        public void segmentFinished(SegmentHandle handle) {
                            store.add(handle);
                            listener.onSegmentStored(handle);
                        }

                        @Override
                        public void segmentFailed(String message, Throwable error) {
                            failFatally(message, error);
                        }
                    });
            nextSegmentIndex++;
            currentSegmentStartPts = ptsNanos;
            currentSegmentStartedNanos = System.nanoTime();
            currentTask = task;
            workers.execute(task);
            return task;
        } catch (EncoderUnavailableException unavailable) {
            failFatally("Recording stopped: " + unavailable.getMessage(), unavailable);
        } catch (IOException ioError) {
            failFatally("Recording stopped, could not write to the clip cache: " + ioError.getMessage(),
                    ioError);
        } catch (RuntimeException error) {
            failFatally("Recording stopped: " + error, error);
        }
        if (writer != null) {
            writer.abort();
        }
        if (encoder != null) {
            encoder.close();
        }
        currentTask = null;
        return null;
    }

    private void failFatally(String message, Throwable error) {
        if (!fatal) {
            fatal = true;
            fatalMessage = message;
            stats.encoderError(message);
            PcpLog.error(message, error);
            listener.onPipelineError(message);
        }
    }

    /**
     * Closes the segment currently being written so its frames become clippable, without
     * stopping capture.
     */
    public void flushCurrentSegment() {
        SegmentTask task = currentTask;
        if (task != null) {
            task.seal();
            currentTask = null;
        }
    }

    /** Stops capture and waits, briefly, for the encoders to finish what they already hold. */
    public void shutdown(long timeoutMillis) {
        running = false;
        SegmentTask task = currentTask;
        if (task != null) {
            task.seal();
            currentTask = null;
        }
        dispatcher.interrupt();
        workers.shutdown();
        try {
            if (!workers.awaitTermination(timeoutMillis, TimeUnit.MILLISECONDS)) {
                PcpLog.warn("Encoder workers did not finish within " + timeoutMillis
                        + " ms; abandoning the tail of the buffer");
                workers.shutdownNow();
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            workers.shutdownNow();
        }
        pool.close();
    }

    /** One line describing the encoder in use, for the status display. */
    public String describeBackend() {
        EncoderCapabilities capabilities = EncoderCapabilities.get();
        return backendName + (capabilities.hardwareAvailable() ? "" : " (software)");
    }
}
