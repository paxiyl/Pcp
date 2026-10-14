package com.pcpclip.core;

import com.pcpclip.core.codec.EncoderCapabilities;
import com.pcpclip.core.codec.EncoderUnavailableException;
import com.pcpclip.core.codec.SegmentCodec;
import com.pcpclip.core.config.ClipConfig;
import com.pcpclip.core.frame.VideoFrame;
import com.pcpclip.core.geom.OutputGeometry;
import com.pcpclip.core.perf.LoadMonitor;
import com.pcpclip.core.pipeline.CapturePipeline;
import com.pcpclip.core.pipeline.ClipExporter;
import com.pcpclip.core.pipeline.PipelineStats;
import com.pcpclip.core.segment.SegmentHandle;
import com.pcpclip.core.segment.SegmentStore;
import com.pcpclip.core.storage.ClipEntry;
import com.pcpclip.core.storage.ClipLibrary;
import com.pcpclip.core.storage.StorageManager;
import com.pcpclip.core.util.Fmt;
import com.pcpclip.core.util.PcpLog;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Everything the Minecraft layer talks to.
 *
 * <p>Holds the rolling buffer, the capture pipeline, the clip library and the performance monitor,
 * and keeps all of the thread discipline in one place: control methods are called from the game
 * thread and return immediately, exports run on their own thread, and encoding happens on the
 * pipeline's workers.
 *
 * <p>With recording switched off this class does nothing at all - there is no pipeline, no thread
 * and no allocation - which is what keeps idle overhead down to a boolean check per frame.
 */
public final class ClipEngine {

    /** Brief, non-blocking messages for the player. */
    public interface Events {
        void toast(String message);

        void error(String message);
    }

    public enum Mode {
        IDLE("Idle"),
        BUFFERING("Buffering"),
        RECORDING("Recording"),
        PAUSED("Paused");

        private final String label;

        Mode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    private final File gameDirectory;
    private final Events events;
    private final StorageManager storage;
    private final ClipLibrary library;
    private final ExecutorService exportExecutor;

    private volatile ClipConfig config;
    private volatile LoadMonitor loadMonitor;
    private volatile CapturePipeline pipeline;
    private volatile SegmentStore store;
    private volatile Mode mode = Mode.IDLE;
    private volatile String contextLabel = "";
    private volatile String lastMessage = "";
    private volatile int lastClipSeconds;
    private volatile long recordingStartPts;
    private volatile double idleFrameMillis;
    /**
     * Whether the capture layer is currently handing over GPU-scaled frames. Owned here so that
     * callers which cannot know - a GUI button, a hotkey - do not have to guess.
     */
    private volatile boolean preScaledCapture;

    private int sourceWidth;
    private int sourceHeight;
    private OutputGeometry geometry;
    private long nextCaptureNanos;
    private long lastReconsiderNanos;
    private final AtomicBoolean exportInFlight = new AtomicBoolean();

    public ClipEngine(File gameDirectory, ClipConfig config, Events events) {
        this.gameDirectory = gameDirectory;
        this.config = config;
        this.events = events;
        this.storage = new StorageManager(gameDirectory, config);
        this.library = new ClipLibrary(storage);
        this.lastClipSeconds = config.clipSeconds;
        this.loadMonitor = new LoadMonitor(config.performanceSaver, 0.0);
        this.exportExecutor = Executors.newSingleThreadExecutor(new ThreadFactory() {
            @Override
            public Thread newThread(Runnable task) {
                Thread thread = new Thread(task, "PcpClip-export");
                thread.setDaemon(true);
                thread.setPriority(Thread.MIN_PRIORITY + 1);
                return thread;
            }
        });
    }

    // ---- accessors -------------------------------------------------------------------------

    public ClipConfig config() {
        return config;
    }

    public StorageManager storage() {
        return storage;
    }

    public ClipLibrary library() {
        return library;
    }

    public LoadMonitor loadMonitor() {
        return loadMonitor;
    }

    public EncoderCapabilities capabilities() {
        return EncoderCapabilities.get();
    }

    public Mode mode() {
        return mode;
    }

    public String lastMessage() {
        return lastMessage;
    }

    public boolean active() {
        return pipeline != null;
    }

    /** World or server name, used to name clips. */
    public void setContextLabel(String label) {
        this.contextLabel = label == null ? "" : label;
    }

    // ---- configuration ---------------------------------------------------------------------

    /**
     * Applies new settings. Anything that changes the shape of the encoded frames restarts the
     * pipeline; anything else takes effect on the next segment.
     */
    public void applyConfig(ClipConfig updated) {
        ClipConfig previous = config;
        updated.validate();
        config = updated;
        storage.setConfig(updated);
        PcpLog.setDebug(updated.debugLogging);

        if (previous.performanceSaver != updated.performanceSaver) {
            loadMonitor = new LoadMonitor(updated.performanceSaver, 0.0);
        }
        SegmentStore currentStore = store;
        if (currentStore != null) {
            currentStore.setBufferNanos(bufferNanos(updated));
        }

        boolean shapeChanged = previous.resolutionPreset != updated.resolutionPreset
                || previous.aspectPreset != updated.aspectPreset
                || previous.customWidth != updated.customWidth
                || previous.customHeight != updated.customHeight
                || previous.customAspectWidth != updated.customAspectWidth
                || previous.customAspectHeight != updated.customAspectHeight
                || previous.fitMode != updated.fitMode
                || previous.encoder != updated.encoder
                || previous.targetFps != updated.targetFps
                || previous.captureMemoryBudgetMb != updated.captureMemoryBudgetMb
                || previous.encoderThreads != updated.encoderThreads
                || previous.segmentMillis != updated.segmentMillis;

        if (!updated.modEnabled || (!updated.shadowBuffer && mode == Mode.BUFFERING)) {
            stopEverything(true);
            return;
        }
        if (shapeChanged && pipeline != null) {
            PcpLog.info("settings changed; restarting capture");
            boolean wasRecording = mode == Mode.RECORDING || mode == Mode.PAUSED;
            stopEverything(true);
            if (wasRecording) {
                events.toast("Recording stopped: capture settings changed");
            }
        }
    }

    private static long bufferNanos(ClipConfig config) {
        return (long) config.shadowBufferSeconds * 1_000_000_000L;
    }

    // ---- capture hooks ---------------------------------------------------------------------

    /** Called every rendered frame with the framebuffer size, which can change at any time. */
    public void notifySourceSize(int width, int height) {
        if (width <= 0 || height <= 0) {
            return;
        }
        if (width == sourceWidth && height == sourceHeight) {
            return;
        }
        sourceWidth = width;
        sourceHeight = height;
        OutputGeometry updated = computeGeometry();
        OutputGeometry existing = geometry;
        geometry = updated;
        if (pipeline != null && existing != null
                && (existing.outWidth != updated.outWidth || existing.outHeight != updated.outHeight
                    || !pipeline.preScaled())) {
            // The encoded frame size changed (or the software path needs differently sized
            // buffers), so the pipeline has to be rebuilt. Segments already written stay valid
            // only if the output size is unchanged.
            boolean keepSegments = existing.outWidth == updated.outWidth
                    && existing.outHeight == updated.outHeight;
            PcpLog.info("display changed to " + width + "x" + height + "; restarting capture"
                    + (keepSegments ? "" : " and clearing the buffer"));
            restartPipeline(keepSegments);
        }
    }

    private OutputGeometry computeGeometry() {
        int[] size = config.outputSize(sourceWidth, sourceHeight);
        return OutputGeometry.compute(sourceWidth, sourceHeight, size[0], size[1],
                config.effectiveFitMode());
    }

    /** Output geometry for the current framebuffer, for the settings screen to display. */
    public OutputGeometry currentGeometry() {
        return geometry != null ? geometry : OutputGeometry.compute(
                sourceWidth > 0 ? sourceWidth : 1920, sourceHeight > 0 ? sourceHeight : 1080,
                config.outputSize(sourceWidth, sourceHeight)[0],
                config.outputSize(sourceWidth, sourceHeight)[1], config.effectiveFitMode());
    }

    /**
     * Geometry the live pipeline is encoding with, which is what the capture layer must use for
     * its crop rectangle. Falls back to the configured geometry when nothing is running.
     */
    public OutputGeometry captureGeometry() {
        CapturePipeline active = pipeline;
        return active != null ? active.geometry() : currentGeometry();
    }

    /**
     * Tells the engine which capture path the renderer ended up using.
     *
     * <p>If the GPU blit path breaks mid-session - a driver refusing a framebuffer, say - frames
     * arrive at framebuffer size instead of output size, and the pipeline's buffers are the wrong
     * shape. Rather than silently capturing nothing, rebuild the pipeline for the new path.
     */
    public void notifyCaptureMode(boolean preScaled) {
        preScaledCapture = preScaled;
        CapturePipeline active = pipeline;
        if (active == null || active.preScaled() == preScaled) {
            return;
        }
        PcpLog.info("capture path changed to " + (preScaled ? "GPU blit" : "software")
                + "; rebuilding the pipeline");
        boolean wasRecording = mode == Mode.RECORDING;
        stopEverything(true);
        if (config.shadowBuffer || wasRecording) {
            if (startPipeline(preScaled)) {
                mode = wasRecording ? Mode.RECORDING : Mode.BUFFERING;
                if (wasRecording) {
                    recordingStartPts = 0L;
                    SegmentStore newStore = store;
                    if (newStore != null) {
                        newStore.retainFrom(0L);
                    }
                }
            }
        }
    }

    /** Render-thread frame time, for the performance saver and for the idle baseline. */
    public void notifyFrameTime(long frameNanos) {
        LoadMonitor monitor = loadMonitor;
        if (pipeline == null) {
            double millis = frameNanos / 1_000_000.0;
            if (millis > 0.0 && millis < 500.0) {
                // Baseline frame time with recording off, used as the budget once it is on.
                idleFrameMillis = idleFrameMillis == 0.0
                        ? millis : idleFrameMillis + (millis - idleFrameMillis) * 0.05;
            }
            return;
        }
        monitor.recordFrameTime(frameNanos);
        long now = System.nanoTime();
        if (now - lastReconsiderNanos > 1_000_000_000L) {
            lastReconsiderNanos = now;
            CapturePipeline active = pipeline;
            if (active != null) {
                monitor.reconsider(active.stats().dropRate(), idleFrameMillis);
            }
        }
    }

    /**
     * Whether this rendered frame should be captured, based on the target rate and on whatever
     * the performance saver has decided.
     */
    public boolean wantsCapture() {
        CapturePipeline active = pipeline;
        if (active == null || active.paused() || active.isFatal()) {
            return false;
        }
        int fps = loadMonitor.effectiveFps(config.targetFps);
        long interval = 1_000_000_000L / Math.max(1, fps);
        long now = System.nanoTime();
        if (now < nextCaptureNanos) {
            return false;
        }
        // Advance by whole intervals, but never try to catch up a long stall: that would burst
        // captures and make the stutter worse.
        nextCaptureNanos = Math.max(now - interval / 2L, nextCaptureNanos + interval);
        return true;
    }

    public VideoFrame acquireFrame() {
        CapturePipeline active = pipeline;
        return active == null ? null : active.acquireFrame();
    }

    public void submitFrame(VideoFrame frame, long readbackCostNanos) {
        CapturePipeline active = pipeline;
        if (active == null) {
            if (frame != null) {
                frame.release();
            }
            return;
        }
        active.offer(frame, readbackCostNanos);
    }

    // ---- lifecycle -------------------------------------------------------------------------

    /**
     * Starts the rolling buffer if it is enabled and not already running.
     *
     * @param preScaled whether the capture layer will hand over GPU-scaled frames
     * @return true when capture is live
     */
    public boolean ensureBuffering() {
        return ensureBuffering(preScaledCapture);
    }

    public boolean ensureBuffering(boolean preScaled) {
        preScaledCapture = preScaled;
        if (!config.modEnabled || !config.shadowBuffer) {
            return pipeline != null;
        }
        if (pipeline != null) {
            return true;
        }
        if (sourceWidth <= 0 || sourceHeight <= 0) {
            return false;
        }
        if (startPipeline(preScaled)) {
            mode = Mode.BUFFERING;
            return true;
        }
        return false;
    }

    private boolean startPipeline(boolean preScaled) {
        if (!storage.writable()) {
            fail("Cannot record: " + storage.clipDirectory() + " is not writable.");
            return false;
        }
        if (storage.lowOnSpace()) {
            fail("Cannot record: only " + storage.describeFreeSpace() + " left (minimum is "
                    + config.minFreeSpaceMb + " MB).");
            return false;
        }
        if (geometry == null) {
            geometry = computeGeometry();
        }
        SegmentStore newStore = new SegmentStore(storage.cacheDirectory(), bufferNanos(config),
                cacheByteCap());
        try {
            CapturePipeline started = CapturePipeline.start(config, newStore, geometry, preScaled,
                    loadMonitor, new CapturePipeline.Listener() {
                        @Override
                        public void onPipelineError(String message) {
                            fail(message);
                            stopEverything(false);
                        }

                        @Override
                        public void onSegmentStored(SegmentHandle handle) {
                            checkSpaceWhileRecording();
                        }
                    });
            store = newStore;
            pipeline = started;
            nextCaptureNanos = System.nanoTime();
            return true;
        } catch (EncoderUnavailableException unavailable) {
            fail(unavailable.getMessage());
            return false;
        }
    }

    /** Cache cap: the buffer's own estimate plus headroom, never more than a quarter of free space. */
    private long cacheByteCap() {
        long estimate = storage.estimateClipBytes(config.shadowBufferSeconds + 10,
                geometry != null ? geometry.outWidth : 1280,
                geometry != null ? geometry.outHeight : 720,
                config.targetFps, SegmentCodec.MJPEG, 0L);
        long free = storage.freeSpaceBytes();
        if (free > 0L) {
            estimate = Math.min(estimate, free / 4L);
        }
        return Math.max(16L * 1024L * 1024L, estimate);
    }

    private void restartPipeline(boolean keepSegments) {
        CapturePipeline active = pipeline;
        boolean wasRecording = mode == Mode.RECORDING;
        boolean preScaled = active != null && active.preScaled();
        stopEverything(!keepSegments);
        if (config.shadowBuffer || wasRecording) {
            if (startPipeline(preScaled)) {
                mode = wasRecording ? Mode.RECORDING : Mode.BUFFERING;
                if (wasRecording) {
                    SegmentStore newStore = store;
                    recordingStartPts = 0L;
                    if (newStore != null) {
                        newStore.retainFrom(0L);
                    }
                }
            }
        }
    }

    /** Stops capture; optionally throws away the buffered segments. */
    public void stopEverything(boolean clearBuffer) {
        CapturePipeline active = pipeline;
        pipeline = null;
        mode = Mode.IDLE;
        if (active != null) {
            active.shutdown(2000L);
        }
        SegmentStore currentStore = store;
        if (currentStore != null && clearBuffer) {
            currentStore.clear();
            store = null;
        }
        loadMonitor.reset();
    }

    public void shutdown() {
        stopEverything(true);
        exportExecutor.shutdown();
        try {
            if (!exportExecutor.awaitTermination(3000L, TimeUnit.MILLISECONDS)) {
                exportExecutor.shutdownNow();
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            exportExecutor.shutdownNow();
        }
    }

    // ---- recording controls ----------------------------------------------------------------

    /**
     * Starts a manual recording. The rolling buffer, if running, is reused: the same encoded
     * frames serve both, so recording while buffering costs nothing extra.
     */
    public void startRecording() {
        startRecording(preScaledCapture);
    }

    public void startRecording(boolean preScaled) {
        if (mode == Mode.RECORDING) {
            return;
        }
        if (mode == Mode.PAUSED) {
            resumeRecording();
            return;
        }
        if (pipeline == null && !startPipeline(preScaled)) {
            return;
        }
        CapturePipeline active = pipeline;
        SegmentStore currentStore = store;
        if (active == null || currentStore == null) {
            return;
        }
        recordingStartPts = active.nowPts();
        currentStore.retainFrom(recordingStartPts);
        mode = Mode.RECORDING;
        announce("Recording started");
    }

    public void pauseRecording() {
        CapturePipeline active = pipeline;
        if (mode != Mode.RECORDING || active == null) {
            return;
        }
        active.pause();
        mode = Mode.PAUSED;
        announce("Recording paused");
    }

    public void resumeRecording() {
        CapturePipeline active = pipeline;
        if (mode != Mode.PAUSED || active == null) {
            return;
        }
        active.resume();
        mode = Mode.RECORDING;
        announce("Recording resumed");
    }

    /** Stops a manual recording and writes it out, in the background. */
    public void stopRecording() {
        final CapturePipeline active = pipeline;
        final SegmentStore currentStore = store;
        if ((mode != Mode.RECORDING && mode != Mode.PAUSED) || active == null || currentStore == null) {
            return;
        }
        if (mode == Mode.PAUSED) {
            active.resume();
        }
        final long from = recordingStartPts;
        final long to = active.nowPts();
        final boolean keepBuffering = config.shadowBuffer;
        mode = keepBuffering ? Mode.BUFFERING : Mode.IDLE;
        active.flushCurrentSegment();
        announce("Saving recording...");

        scheduleExport(from, to, (int) Math.max(1L, (to - from) / 1_000_000_000L), true);

        // Retention is released only after the export has run and locked what it needs. Clearing
        // it here would let the rolling buffer prune the start of the recording - which can be
        // well outside the buffer window - before the export got to it. The export runs on this
        // same single thread, so queueing the release behind it is enough.
        exportExecutor.execute(new Runnable() {
            @Override
            public void run() {
                currentStore.clearRetention();
                if (!keepBuffering) {
                    stopEverything(true);
                }
            }
        });
    }

    /** Saves the last {@code seconds} of the rolling buffer. */
    public void saveRollingClip(int seconds) {
        CapturePipeline active = pipeline;
        if (active == null) {
            if (!config.shadowBuffer) {
                fail("The instant replay buffer is switched off (enable it in PcpClip settings).");
            } else {
                fail("The buffer is not running yet.");
            }
            return;
        }
        int clamped = Math.max(1, Math.min(config.shadowBufferSeconds, seconds));
        lastClipSeconds = clamped;
        long to = active.nowPts();
        long from = Math.max(0L, to - (long) clamped * 1_000_000_000L);
        active.flushCurrentSegment();
        announce("Saving last " + clamped + "s...");
        scheduleExport(from, to, clamped, false);
    }

    /** Repeats the previous save without opening a menu. */
    public void saveLastAgain() {
        saveRollingClip(lastClipSeconds > 0 ? lastClipSeconds : config.clipSeconds);
    }

    private void scheduleExport(final long fromPts, final long toPts, final int requestedSeconds,
                                final boolean manualRecording) {
        if (!exportInFlight.compareAndSet(false, true)) {
            fail("Already saving a clip; try again in a moment.");
            return;
        }
        final CapturePipeline active = pipeline;
        final SegmentStore currentStore = store;
        final ClipConfig snapshot = config;
        if (active == null || currentStore == null) {
            exportInFlight.set(false);
            return;
        }
        final SegmentCodec codec = active.codec();
        final OutputGeometry exportGeometry = active.geometry();
        final PipelineStats stats = active.stats();

        exportExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    runExport(currentStore, snapshot, codec, exportGeometry, stats, fromPts, toPts,
                            requestedSeconds, manualRecording);
                } catch (RuntimeException error) {
                    PcpLog.error("Export failed", error);
                    fail("Could not save the clip: " + error);
                } finally {
                    exportInFlight.set(false);
                }
            }
        });
    }

    private void runExport(SegmentStore currentStore, ClipConfig snapshot, SegmentCodec codec,
                           OutputGeometry exportGeometry, PipelineStats stats,
                           long fromPts, long toPts, int requestedSeconds, boolean manualRecording) {
        // Give the worker a moment to finish the segment that was just sealed, so the clip
        // actually contains the last second or two of action.
        long deadline = System.currentTimeMillis() + 2000L;
        while (System.currentTimeMillis() < deadline && currentStore.newestPts() < toPts - 50_000_000L) {
            try {
                Thread.sleep(25L);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        SegmentStore.Selection selection = currentStore.selectRange(fromPts, toPts);
        if (selection.isEmpty()) {
            currentStore.release(selection);
            fail("Nothing buffered yet - give it a few seconds.");
            return;
        }
        try {
            long estimate = selection.bytes();
            if (storage.wouldOverfill(estimate)) {
                fail("Not enough storage for a " + Fmt.bytes(estimate) + " clip ("
                        + storage.describeFreeSpace() + ").");
                return;
            }
            File target = storage.newClipFile(codec.containerExtension(), contextLabel);
            File partial = storage.partialFor(target);
            ClipExporter.Options options = new ClipExporter.Options(
                    snapshot.fixedFrameRateExport, snapshot.targetFps);
            ClipExporter.Result result = ClipExporter.export(selection, partial, codec,
                    exportGeometry.outWidth, exportGeometry.outHeight, snapshot.targetFps, options);
            if (!result.success) {
                fail(result.message);
                return;
            }
            // Publish only now that the file is complete, so the clip list never shows a clip
            // that is still being written.
            File published = storage.publish(partial, target);
            writeSidecar(published, result, snapshot, codec, exportGeometry, stats, requestedSeconds,
                    manualRecording);

            StringBuilder message = new StringBuilder();
            message.append("Clip saved: ").append(published.getName())
                    .append("  ").append(Fmt.duration((long) (result.durationSeconds * 1000.0)))
                    .append("  ").append(Fmt.bytes(result.bytes));
            if (result.measuredFps > 0.0) {
                message.append(String.format(Locale.ROOT, "  %.0f fps", result.measuredFps));
            }
            List<ClipEntry> pruned = library.pruneTo(
                    (long) snapshot.maxLibraryGb * 1024L * 1024L * 1024L);
            if (!pruned.isEmpty()) {
                message.append("  (").append(pruned.size())
                        .append(" old clip(s) removed to stay under the folder cap)");
            }
            announce(message.toString());
            if (result.trimmedToSegmentBoundary) {
                PcpLog.info("clip start was moved to a segment boundary (H.264 keyframe)");
            }
        } finally {
            currentStore.release(selection);
        }
    }

    private void writeSidecar(File published, ClipExporter.Result result, ClipConfig snapshot,
                              SegmentCodec codec, OutputGeometry exportGeometry,
                              PipelineStats stats, int requestedSeconds, boolean manualRecording) {
        Map<String, String> meta = new LinkedHashMap<String, String>();
        meta.put("savedAt", Long.toString(System.currentTimeMillis()));
        meta.put("width", Integer.toString(exportGeometry.outWidth));
        meta.put("height", Integer.toString(exportGeometry.outHeight));
        meta.put("frames", Integer.toString(result.frames));
        meta.put("durationSeconds", String.format(Locale.ROOT, "%.3f", result.durationSeconds));
        meta.put("measuredFps", String.format(Locale.ROOT, "%.2f", result.measuredFps));
        meta.put("targetFps", Integer.toString(snapshot.targetFps));
        meta.put("codec", codec.codecName());
        meta.put("container", codec.containerExtension());
        meta.put("source", "manual recording");
        if (!manualRecording) {
            meta.put("source", "rolling buffer, last " + requestedSeconds + "s");
        }
        meta.put("world", contextLabel);
        meta.put("fitMode", snapshot.effectiveFitMode().name());
        meta.put("crop", exportGeometry.toString());
        meta.put("capturedFrames", Long.toString(stats.capturedFrameCount()));
        meta.put("droppedFrames", Long.toString(stats.droppedFrameCount()));
        meta.put("sessionMeasuredFps", String.format(Locale.ROOT, "%.2f", stats.measuredCaptureFps()));
        meta.put("fixedRateExport", Boolean.toString(result.fixedRateApplied));
        meta.put("trimmedToSegmentBoundary", Boolean.toString(result.trimmedToSegmentBoundary));
        meta.put("performanceSaverLevel", Integer.toString(loadMonitor.level()));
        if (result.measuredFps > 0.0 && snapshot.targetFps > 0
                && result.measuredFps < snapshot.targetFps * 0.9) {
            meta.put("note", "The game rendered fewer frames than the " + snapshot.targetFps
                    + " fps target; this clip holds " + result.frames
                    + " real frames and its timestamps reflect that.");
        }
        library.writeSidecar(published, meta);
    }

    private void checkSpaceWhileRecording() {
        if (!storage.lowOnSpace()) {
            return;
        }
        fail("Storage is nearly full (" + storage.describeFreeSpace() + "); recording stopped.");
        stopEverything(false);
    }

    private void announce(String message) {
        lastMessage = message;
        PcpLog.info(message);
        events.toast(message);
    }

    private void fail(String message) {
        lastMessage = message;
        PcpLog.warn(message);
        events.error(message);
    }

    // ---- status ----------------------------------------------------------------------------

    /** Immutable snapshot for the HUD and the settings screens. */
    public static final class Status {

        public final Mode mode;
        public final boolean bufferEnabled;
        public final int bufferSeconds;
        public final double bufferedSeconds;
        public final long bufferBytes;
        public final int segments;
        public final int outputWidth;
        public final int outputHeight;
        public final int targetFps;
        public final double measuredFps;
        public final long capturedFrames;
        public final long droppedFrames;
        public final double dropPercent;
        public final double readbackMillis;
        public final double encodeMillis;
        public final int backlog;
        public final String backend;
        public final int performanceLevel;
        public final String performanceReason;
        public final String lastMessage;
        public final String freeSpace;
        public final boolean cropped;
        public final boolean letterboxed;

        Status(Mode mode, boolean bufferEnabled, int bufferSeconds, double bufferedSeconds,
               long bufferBytes, int segments, int outputWidth, int outputHeight, int targetFps,
               double measuredFps, long capturedFrames, long droppedFrames, double dropPercent,
               double readbackMillis, double encodeMillis, int backlog, String backend,
               int performanceLevel, String performanceReason, String lastMessage, String freeSpace,
               boolean cropped, boolean letterboxed) {
            this.mode = mode;
            this.bufferEnabled = bufferEnabled;
            this.bufferSeconds = bufferSeconds;
            this.bufferedSeconds = bufferedSeconds;
            this.bufferBytes = bufferBytes;
            this.segments = segments;
            this.outputWidth = outputWidth;
            this.outputHeight = outputHeight;
            this.targetFps = targetFps;
            this.measuredFps = measuredFps;
            this.capturedFrames = capturedFrames;
            this.droppedFrames = droppedFrames;
            this.dropPercent = dropPercent;
            this.readbackMillis = readbackMillis;
            this.encodeMillis = encodeMillis;
            this.backlog = backlog;
            this.backend = backend;
            this.performanceLevel = performanceLevel;
            this.performanceReason = performanceReason;
            this.lastMessage = lastMessage;
            this.freeSpace = freeSpace;
            this.cropped = cropped;
            this.letterboxed = letterboxed;
        }

        public boolean recording() {
            return mode == Mode.RECORDING || mode == Mode.PAUSED;
        }
    }

    public Status status() {
        CapturePipeline active = pipeline;
        SegmentStore currentStore = store;
        OutputGeometry current = currentGeometry();
        PipelineStats stats = active != null ? active.stats() : null;
        return new Status(
                mode,
                config.shadowBuffer,
                config.shadowBufferSeconds,
                currentStore != null ? currentStore.coveredNanos() / 1_000_000_000.0 : 0.0,
                currentStore != null ? currentStore.totalBytes() : 0L,
                currentStore != null ? currentStore.count() : 0,
                current.outWidth,
                current.outHeight,
                config.targetFps,
                stats != null ? stats.measuredCaptureFps() : 0.0,
                stats != null ? stats.capturedFrameCount() : 0L,
                stats != null ? stats.droppedFrameCount() : 0L,
                stats != null ? stats.dropRate() * 100.0 : 0.0,
                stats != null ? stats.averageReadbackMillis() : 0.0,
                stats != null ? stats.averageEncodeMillis() : 0.0,
                active != null ? active.backlog() : 0,
                active != null ? active.describeBackend() : "not started",
                loadMonitor.level(),
                loadMonitor.reason(),
                lastMessage,
                storage.describeFreeSpace(),
                current.cropped,
                current.letterboxed || current.pillarboxed);
    }

    /** Segment files left over from a previous session, for the clip-history screen. */
    public List<SegmentHandle> recoverableSegments() {
        return SegmentStore.findOrphans(storage.cacheDirectory());
    }

    /**
     * Exports leftover segments from a crashed session into a clip.
     *
     * <p>Runs on the export thread and reports through the usual toast, so the caller can fire it
     * from a button and forget about it.
     */
    public void recoverOrphans() {
        if (pipeline != null) {
            fail("Stop recording before recovering an interrupted session.");
            return;
        }
        if (!exportInFlight.compareAndSet(false, true)) {
            return;
        }
        final ClipConfig snapshot = config;
        exportExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    List<SegmentHandle> orphans = SegmentStore.findOrphans(storage.cacheDirectory());
                    if (orphans.isEmpty()) {
                        fail("No interrupted recording was found.");
                        return;
                    }
                    SegmentHandle first = orphans.get(0);
                    SegmentStore recovery = new SegmentStore(storage.cacheDirectory(), 0L, 0L);
                    for (SegmentHandle handle : orphans) {
                        recovery.add(handle);
                    }
                    SegmentStore.Selection selection = recovery.selectRange(0L, Long.MAX_VALUE);
                    try {
                        File target = storage.newClipFile(first.codec.containerExtension(), "recovered");
                        File partial = storage.partialFor(target);
                        ClipExporter.Result result = ClipExporter.export(selection, partial,
                                first.codec, first.width, first.height,
                                first.targetFps > 0 ? first.targetFps : snapshot.targetFps,
                                new ClipExporter.Options(false, snapshot.targetFps));
                        if (result.success) {
                            File published = storage.publish(partial, target);
                            announce("Recovered " + result.frames + " frames into "
                                    + published.getName());
                            recovery.clear();
                        } else {
                            fail(result.message);
                        }
                    } finally {
                        recovery.release(selection);
                    }
                } finally {
                    exportInFlight.set(false);
                }
            }
        });
    }
}
