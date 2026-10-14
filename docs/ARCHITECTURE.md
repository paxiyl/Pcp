# Architecture

## The one decision everything else follows from

A recording mod can be fast or it can be simple, and the usual way it becomes slow is that the
render thread ends up doing work it should not: compressing an image, writing a file, allocating
a buffer, or waiting for one of those. So the rule here is that **the render thread only ever
moves pixels into a buffer that already exists**, and everything else happens somewhere else,
with every queue bounded so that "somewhere else" can never grow without limit.

```
render thread                     dispatcher              encoder workers        export thread
-------------                     ----------              ---------------        -------------
wantsCapture()  ──┐
acquireFrame()    │  pooled buffer, or nothing
glReadPixels   ───┤
offer(frame)   ───┴──► inbox ───► rotate segments ───► encode ───► segment file
                      (bounded)   one task per segment            on disk
                                                                      │
                                                       select + copy ─┴──► clip file
```

Four threads, and only the first belongs to Minecraft:

| Thread | Does | Never does |
|---|---|---|
| render | decides whether to capture, reads pixels into a pooled buffer, hands it over | encode, allocate, write, wait |
| dispatcher | rotates segments, opens files, creates encoders | touch GL |
| encoder workers (1-3) | convert pixels, encode, write segment files | block the render thread |
| export | reads segments, writes the clip container | encode, or run while capture needs the CPU |

Workers run below normal priority: the game's own threads must win a contested core.

## Why the rolling buffer is segments on disk

Keeping the last two minutes as raw frames would need gigabytes of RAM (1080p RGBA is 8.3 MB a
frame). Keeping it as one long encoded file would make "the last 30 seconds" impossible to cut
without a decoder. So the buffer is a deque of short, **independently decodable** segments:

* each segment starts with a keyframe, because it gets its own encoder instance;
* clipping is therefore a copy of whole segments plus a trim, with no re-encoding - which is why
  saving is near-instant even for two minutes;
* pruning is deleting the oldest file, so memory and disk are bounded by configuration rather
  than by session length;
* and a crash leaves finished segments behind, which is what makes recovery possible at all.

Manual recording is the same machinery with a retention mark: "do not prune anything after this
timestamp". So recording *while* buffering costs nothing extra - one set of encoded frames serves
both.

### Segment format

```
header   "PCPSEG" + version, codec, width, height, target fps, wall clock, first timestamp
records  [int length][long ptsNanos][byte flags][payload]
trailer  [int -1][int frameCount][long lastPts]
```

Append-only, and the reader stops at the first short record - so a file truncated by a crash
yields every complete frame before the damage. (Asserted by a test that truncates one.)

## Why capture happens at the end of the render tick

In Forge 1.8.9, `RenderTickEvent` END fires inside `Minecraft.runGameLoop`, after
`EntityRenderer.updateCameraAndRender` and **before** the game's framebuffer is blitted to the
display. At that instant:

* the world, the HUD and any open screen have all been drawn into the game's framebuffer, so one
  complete frame exists;
* the framebuffer texture can be sampled cheaply - this is the same object vanilla's screenshot
  code reads;
* and anything drawn *afterwards* reaches the screen but not the capture, which is how the
  recording indicator stays out of clips.

No render-path hook is installed, nothing is patched, and the game's framebuffer is never
resized. That is the main reason OptiFine and GL4ES are expected to be unaffected.

## Why crop and letterbox instead of a custom viewport

Ultrawide output could be done by rendering the game into a differently shaped viewport. That is
also the approach most likely to break OptiFine or GL4ES, since it means changing the game's own
framebuffer mid-frame. So PcpClip captures the frame the game actually drew and reshapes *that*:

* **crop**: take the largest centred region of the frame with the output's aspect ratio, and
  scale it to fill the output;
* **letterbox**: scale the whole frame to fit inside the output and pad with black.

Both apply the *same* scale horizontally and vertically, which is the whole point: the world, the
HUD, the crosshair, text, the hotbar and the inventory keep their proportions. `OutputGeometry`
computes it and exposes `distortion()`; the test suite asserts it is 1.0 within pixel rounding
across 128 source, output and fit-mode combinations.

`FitMode.VIEWPORT` exists in the enum, documents why it is unavailable, and resolves to letterbox.

## Why the GPU does the cropping

The capture path draws the frame once into a private framebuffer the size of the output, using
the crop rectangle as texture coordinates. One draw call buys three things:

1. the scaling is done by the GPU, filtered, instead of per-pixel on a CPU;
2. only the output-sized region is read back - a 720p clip from a 2400x1080 phone screen moves
   3.7 MB a frame instead of 10.4 MB;
3. crop and letterbox need no extra code - the quad goes where the geometry says, and the rest of
   the frame is cleared to black.

If framebuffer objects are unavailable the whole frame is read and an encoder worker does the
crop and scale instead: more bytes, same result.

## What the render thread actually costs

Per rendered frame, with recording **off**: one `System.nanoTime()`, one volatile read, a
comparison, a return.

Per rendered frame, with recording **on** but this frame not due for capture: the above plus one
more comparison.

Per **captured** frame: one framebuffer bind, a few state changes, one quad, one `glReadPixels`
(or a pixel-buffer request where supported), one queue offer. No allocation, no file I/O, no
compression, and no waiting - if no buffer is free or the queue is full, the frame is dropped in
nanoseconds and counted.

## Where the bounds are

| Resource | Bound | What happens at the limit |
|---|---|---|
| Capture buffers | `performance.captureMemoryBudgetMb` (2-8 frames) | the render thread drops the frame |
| Inbox queue | pool size | the frame is dropped and counted |
| Per-segment queue | pool size | the dispatcher waits briefly, then drops |
| Buffer cache on disk | buffer length, plus a byte cap | the oldest segment is deleted |
| Clip folder | `storage.maxLibraryGb` (0 = never) | the oldest clips are deleted, only if asked |
| Free space | `storage.minFreeSpaceMb` | recording refuses to start, or stops |

The frame pool is the key one: a frame cannot enter the pipeline without a buffer, so the number
of buffers *is* the maximum backlog. There is no code path in which the pipeline grows because
the encoder is slow.

## Encoder backends

A small SPI (`VideoEncoder`, `PacketSink`), one instance per segment, so implementations need no
locking and each segment can start with a keyframe.

| Backend | Container | Notes |
|---|---|---|
| Motion JPEG (ImageIO) | AVI | The one that works everywhere; cheapest; every frame a keyframe |
| H.264 (JCodec) | MP4 | Pure Java, no native code; expensive; MP4 is what Android apps accept |
| Hardware bridge | - | Seam only; see [COMPATIBILITY.md](COMPATIBILITY.md) for why |

Both muxers are written here rather than taken from a library, which keeps the jar free of native
code and gives exact control over timing: MP4 gets per-sample durations from real capture
timestamps, and AVI - which has only one rate for the whole file - is patched at the end with the
rate that was actually achieved, so playback length matches reality.

## Adapting while running

`LoadMonitor` watches render-thread frame time (exponentially smoothed) and the drop rate, and
steps capture down in up to three levels - capture rate first, then encoder quality - with
hysteresis so it cannot oscillate. It steps back up after ten quiet seconds. Quality is applied
per segment, which is free, because each segment builds its own encoder anyway. Configured
settings are never changed; only what is used right now.

## Honesty, as a design constraint

Several decisions exist only to stop the mod overstating itself:

* Capture timestamps come from the real capture time, and MP4 stores per-sample durations, so a
  clip never claims a frame rate it does not have.
* `PipelineStats.measuredCaptureFps()` is what the UI and the `.pcpinfo` sidecar report, next to
  the target - and the clip list marks a clip whose captured rate fell short.
* Fixed-rate export is refused for H.264 rather than faked by duplicating coded frames.
* The hardware-encoder probe reports *why* it found nothing instead of quietly falling back.
* `EncoderCapabilities` sizes its estimates from measurements, halved for phone hardware, and the
  settings screen prints the verdict before a preset is chosen.

## Layout

```
src/main/java/com/pcpclip/
  core/            no Minecraft types anywhere - which is what makes it testable
    config/        settings, validation, output-size derivation
    geom/          OutputGeometry: the no-distortion maths
    frame/         bounded pool of direct pixel buffers
    codec/         encoder SPI, Motion JPEG, JCodec H.264, colour conversion, capability probe
    mux/           AVI and MP4 writers
    segment/       segment format, reader, writer, the bounded rolling store
    pipeline/      capture pipeline, per-segment tasks, statistics, clip export
    perf/          load monitor
    storage/       paths, space, naming, clip library and sidecars
    ClipEngine     the facade the Minecraft layer talks to
  mc/              everything that touches Minecraft or GL
    capture/       renderer probe, framebuffer blit, pixel-buffer readback
    ui/            HUD overlay and the settings screens
    PcpClipMod     mod entry point
    ClientHooks    the render-tick and client-tick handlers
    KeyBindings    four rebindable hotkeys
```

The split is not cosmetic: the core is where the risk is - encoders, muxers, timing, bounds - and
keeping Minecraft out of it is what allows all of it to be run and measured without a game
client. See [TESTING.md](TESTING.md).
