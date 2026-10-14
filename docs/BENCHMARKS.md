# Benchmarks

## What is measured, and what is not

Recording cost splits into three parts:

1. **Readback** - taking the finished frame out of the GPU. Happens on the render thread, so this
   is the part that costs FPS. **Needs a device; not measured here.**
2. **Conversion and encoding** - turning pixels into a compressed frame. Happens on worker
   threads. **Measured below.**
3. **Writing and muxing** - segments to disk, then a container file. Happens off the game's
   threads entirely. **Measured as part of the test suite.**

No FPS-impact figure is claimed, because claiming one without a phone would be inventing it. What
*can* be stated from here is the throughput each encoder sustains per thread, which is what
decides whether a preset is realistic - and it is the number the automatic encoder choice uses.

## Machine

```
java 1.8.0_504, amd64, 4 cpus (cloud VM, no GPU, no Minecraft client)
```

A phone's big core running scalar Java is slower than this, and throttles once warm. The
automatic encoder choice therefore uses roughly **half** these measured rates (see
`EncoderCapabilities`), so it under-promises rather than over-promises.

Reproduce with:

```bash
tools/bootstrap-devenv.sh
tools/run-tests.sh bench
```

## Per-frame cost by preset

Measured over 40 frames after 15 warm-up frames, on synthetic gameplay-like content (gradient
background plus a moving block, so both JPEG and motion estimation have real work).

The frame size is what costs; the target frame rate column only shows which preset was run (it
affects JCodec's keyframe interval, not the per-frame cost), which is why the repeated sizes
agree to within run-to-run noise.

| output | target | convert to BGR | Motion JPEG q55 | MJPEG frame | convert to YUV | H.264 qp26 | H.264 frame |
|---|---|---|---|---|---|---|---|
| 854x480 | 30 | 0.9 ms | 11.2 ms (89 fps/thread) | 19 KB | 1.6 ms | 29.3 ms (34 fps/thread) | 13 KB |
| 1280x720 | 30 | 2.7 ms | 26.7 ms (37 fps/thread) | 38 KB | 2.2 ms | 59.3 ms (17 fps/thread) | 29 KB |
| 1280x720 | 60 | 1.5 ms | 26.7 ms (37 fps/thread) | 38 KB | 2.0 ms | 74.9 ms (13 fps/thread) | 29 KB |
| 1920x1080 | 30 | 4.5 ms | 54.5 ms (18 fps/thread) | 66 KB | 6.7 ms | 178.8 ms (5.6 fps/thread) | 64 KB |
| 1920x1080 | 60 | 3.5 ms | 56.0 ms (18 fps/thread) | 66 KB | 4.3 ms | 192.8 ms (5.2 fps/thread) | 64 KB |
| 1920x1080 | 120 | 5.1 ms | 58.6 ms (17 fps/thread) | 66 KB | 6.2 ms | 156.2 ms (6.4 fps/thread) | 64 KB |
| 2520x1080 | 30 | 4.4 ms | 71.5 ms (14 fps/thread) | 87 KB | 5.6 ms | 223.0 ms (4.5 fps/thread) | 83 KB |

Sustained pixel rate per worker thread:

| backend | measured here | assumed for a phone |
|---|---|---|
| Motion JPEG | 35-37 Mpx/s | 18 Mpx/s |
| H.264 (JCodec, software) | 12.8-13.0 Mpx/s | 7 Mpx/s |

Spread on the default preset (1280x720), 40 frames:

| backend | mean | median | p95 | max |
|---|---|---|---|---|
| Motion JPEG | 27.2 ms | 24.9 ms | 35.2 ms | 39.3 ms |
| H.264 | 66.7 ms | 62.4 ms | 94.4 ms | 95.6 ms |

## What that means for the presets

Pixel rate needed, against the phone-conservative rates above:

| preset | pixels/second | MJPEG threads | H.264 threads | realistic on a phone? |
|---|---|---|---|---|
| 480p30 | 12.3 M | 0.7 | 1.8 | yes, comfortably |
| **720p30 (default)** | 27.6 M | 1.5 | 3.9 | **yes with Motion JPEG**; H.264 needs 4 threads |
| 720p60 | 55.3 M | 3.1 | 7.9 | Motion JPEG only, on a strong device |
| 1080p30 | 62.2 M | 3.5 | 8.9 | Motion JPEG only, on a strong device |
| 1080p60 | 124.4 M | 6.9 | 17.8 | no - expect heavy frame dropping |
| 1080p120 | 248.8 M | 13.8 | 35.5 | no - most frames will be dropped |
| 2520x1080 30 (21:9) | 81.6 M | 4.5 | 11.7 | Motion JPEG only, on a strong device |

This is why the default is 720p30 and why the automatic encoder picks Motion JPEG for it: at the
default, one or two threads do the job, which leaves the CPU to the game.

All of these remain selectable. The video settings screen prints the verdict for the current
preset before you commit to it, for example:

```
Likely too demanding: needs about 35.5 encoder threads, 3 available. Frames will be dropped -
lower the resolution or frame rate, or use Motion JPEG.
```

## Behaviour when a preset is too demanding

From the test suite, 1080p at 120 fps through a single software H.264 worker for 4 seconds:

```
attempted 478 captures, kept 24, dropped 454 (95%), backlog 1 frame, heap grew 37 MB
```

The useful part is not the 95% - it is the **backlog of one frame** and the **bounded heap**. The
pipeline does not queue what it cannot encode: the frame pool is the memory bound, and a frame
that cannot get a buffer is dropped on the render thread in a few nanoseconds. Nothing waits on
the encoder, nothing grows, and the game keeps running. With the performance saver on (it was off
for this test, to measure the raw behaviour) the capture rate would have stepped down instead.

## Storage

Measured bytes per frame, from the table above:

| preset | Motion JPEG | H.264 |
|---|---|---|
| 720p30 | 1.1 MB/s - 34 MB per 30 s | 0.87 MB/s - 26 MB per 30 s |
| 1080p30 | 1.9 MB/s - 58 MB per 30 s | 1.9 MB/s - 56 MB per 30 s |
| 2520x1080 30 | 2.5 MB/s - 76 MB per 30 s | 2.4 MB/s - 73 MB per 30 s |

Two notes:

* The rolling buffer costs this much **continuously** while it is on, bounded by its length - a
  30 s buffer at 720p30 is about 34 MB of cache, not more, however long you play.
* JCodec's H.264 at qp26 is barely smaller than Motion JPEG at q55, and costs two to three times
  the CPU. Its real advantage is **MP4**, which Android galleries and chat apps accept and AVI
  often is not. Raising `video.h264Qp` shrinks H.264 files substantially if size matters more
  than quality.

## Idle cost

With the buffer off and no recording there is no pipeline, no thread, no buffer and no GL work.
Per rendered frame the mod does: one `System.nanoTime()`, one volatile read, a comparison, and an
early return. Per client tick it polls four key bindings. The overlay returns before touching GL
when there is nothing to draw.

## Measuring the FPS cost on your own device

The numbers that are missing from this document are the ones only a device can give. The mod
carries the instrumentation to collect them:

1. **Settings -> Performance -> Status overlay: On.**
2. Note your FPS (F3) with the buffer **off** - move through the same area each time, since
   Minecraft's own FPS varies hugely with what is on screen.
3. Turn the buffer **on** and note FPS again, plus the overlay's `read` figure, which is the
   readback cost on the render thread in milliseconds per captured frame.
4. Start a manual recording and note it a third time. (Recording while buffering costs nothing
   extra - the same encoded frames serve both - so figures 2 and 3 should match.)
5. The overlay's `drops` is the honest check: a non-zero drop percentage means the preset is
   beyond the device, whatever the FPS looks like.

A useful sanity bound while interpreting the result: at 720p the readback moves 3.7 MB per
captured frame, so at 30 fps that is 111 MB/s over the bus. If that figure dominates your result,
lower the resolution before anything else - it reduces readback, conversion and encoding all at
once.
