# Testing

```bash
tools/bootstrap-devenv.sh     # once: fetches JDK 8, the 1.8.9 client, MCP mappings, SpecialSource
tools/run-tests.sh            # the suite
tools/run-tests.sh bench      # the encoder benchmark
```

Last run on this repository:

```
java 1.8.0_504 on Linux amd64, 4 cpus
ffprobe available: true
checks: 1319, failures: 0, time: 45s
ALL TESTS PASSED
```

## Why it can be tested at all

Nothing in `com.pcpclip.core` imports a Minecraft or Forge type. That is a deliberate constraint
rather than tidiness: it means the encoders, the muxers, the rolling buffer, the export path and
the whole engine can be driven on a bare JVM, with real pixels going in and real video files
coming out. The suite feeds synthetic gameplay-like frames (a gradient with a moving block, so
neither JPEG nor motion estimation gets an unrealistically easy ride) through the same code the
game drives.

Where a check could be satisfied by our own code agreeing with itself, it is verified externally
instead: clips are decoded with **ffprobe** and **ffmpeg**, and the built jar's Minecraft
references are resolved against a real SRG-named Minecraft 1.8.9 client.

The suite uses no test framework, so it runs on whatever JRE is to hand - the same reason the mod
avoids dependencies.

## What is covered

### Geometry - the no-distortion guarantee (`GeometryTests`)

* 128 combinations of 8 framebuffer shapes (including 2400x1080, 1080x2400 portrait, 4:3, 16:10
  and a deliberately odd 1281x721) against 8 output shapes, in both fit modes. Every one asserts
  the horizontal and vertical scale are equal within pixel rounding - a squashed HUD would fail
  here.
* Output dimensions are always even, crop rectangles stay inside the source, placement stays
  inside the output.
* 21:9 from 16:9 trims height and not width; 9:16 trims width and not height.
* Letterboxing adds bars and keeps the source ratio in the placed rectangle.
* 1080p at 21:9 is exactly 2520x1080; 9:16 rounds to an even 608; match-screen reproduces the
  framebuffer ratio; odd custom sizes round down.

### Orientation (`OrientationTests`)

Added after the first on-device clips came out upside down while every other test passed. Each
check paints a known colour into a known corner of the *source* buffer, in the GL bottom-up order
the capture layer really delivers, and insists on finding it in the right corner of the *decoded*
output:

* RGBA to BGR and RGBA to YUV, at the conversion level;
* a Motion JPEG frame, decoded back with ImageIO;
* an H.264 clip, decoded with ffmpeg;
* a cropped ultrawide frame and a letterboxed frame, including that the bars are where they
  should be and the picture between them is the right way up.

### Robustness (`RobustnessTests`)

Added after every on-device clip held exactly one frame:

* the capture rate is capped at measured encoder throughput (120 fps asked for, 50 ms/frame on
  two workers, gives 34) and is not throttled on too little evidence, nor below 5 fps;
* a segment whose 40 frames all claim the same instant still exports 40 frames, on a synthetic
  timeline, with the result reporting that the timing was invented - ffprobe confirms the count;
* feeding the engine 40 frames with a frozen timestamp has all 39 repeats corrected and counted,
  and the buffer still advances so segments still rotate.

### Settings (`ConfigTests`)

* Defaults are the performance-focused ones (buffer off, 720p30, saver on, audio off).
* A full round trip through a file: every field written, re-read and compared.
* Nonsense is clamped **and reported**: 9000 fps, a negative buffer length, a 99999-pixel width,
  a 10 ms segment - each produces a message for the settings screen.
* Unreadable values fall back rather than throwing; trailing `# comments` are tolerated; unknown
  enum names fall back; a missing file is just defaults.
* `FitMode.VIEWPORT` resolves to letterbox and says so.

### The rolling buffer (`SegmentTests`)

* Segments round-trip: timestamps increase, keyframe flags and payloads survive.
* **A file truncated mid-record still yields every complete frame** - the crash case.
* A foreign file is rejected cleanly rather than read as garbage.
* The buffer stays bounded by **duration** (40 segments into a 10 s buffer) and by **bytes**, and
  pruned files are really deleted from disk, not just forgotten.
* A segment locked by an in-progress export is **not** pruned, and is pruned once released.
* A retention mark keeps a manual recording intact while it runs, and pruning resumes after.
* Orphan discovery finds a previous session's segments with their counts and timeline.

### Export (`ExportTests`)

Against real encoded segments, not fixtures:

* Motion JPEG trims to the exact requested span (2 s asked for out of 6 s buffered: 40 frames at
  20 fps, 1.95 s, confirmed by ffprobe).
* Fixed-rate export fills every slot: 30 real frames captured at 10 fps become 88 frames at 30 fps
  over the same 2.9 s of wall-clock time.
* **H.264 refuses to fake a fixed rate** - the result reports the flag as not applied and only
  the real frames are written.
* An H.264 clip asked for from mid-segment is moved back to the keyframe, says so in the result,
  loses no footage, and every written frame decodes (ffprobe counts them).

### A recording session end to end (`RecordingTests`)

The engine is driven as a render loop would drive it, for several seconds of real time:

* **Rolling buffer, Motion JPEG**: 80 frames captured at 20 fps, clip saved, named after the
  world, correct dimensions, sidecar written, ffprobe confirms `mjpeg` 480x270, 59 frames,
  2.95 s, and every frame decodes.
* **Rolling buffer, H.264**: same, ffprobe confirms `h264`, 66 frames, 3.30 s (longer than the
  3 s asked for, because of the keyframe boundary - as documented).
* **Manual recording with pause and resume**: no frames captured while paused, and the paused
  time does not appear in the clip's duration.
* **A clip only becomes visible once complete** - the test waits for the save confirmation and
  then finds the clip, which is also the assertion that partial files never show up in the list.
* **Overload**: 1080p at 120 fps through one software H.264 worker - 95% of captures dropped,
  backlog never above 2 frames, heap growth bounded, and no errors raised. Degrading, not failing.
* **A long session**: 11 seconds against a 5 second buffer - buffered span, cached bytes and
  segment count all flat, and no segment files left on disk beyond the live ones.
* **Saving with the buffer off** explains itself in a message that mentions the buffer, and
  writes nothing.
* **The clip folder cap** is off by default, never deletes at zero, and removes exactly the
  oldest clip when set.
* **A recording longer than the buffer window keeps its start**: with a 5 s buffer and an 8 s
  recording, 8 s stays retained while recording, the saved clip is 7 s rather than 5 s, and
  pruning resumes to 5 s once the export has finished. This is the case the retention mark exists
  for, and it also pins down the ordering - retention is released only after the export has
  locked the segments it needs, or the start of the recording would be pruned before it is
  written.

### The built jar

Run as the last two steps of `tools/build-jar.sh`:

* `tools/verify_reobf.py` - the jar holds the mod classes and bundled JCodec, no compile-only
  Forge stubs and no Minecraft classes leaked in, `mcmod.info` is present, enough SRG references
  exist to prove the remap ran, and **no readable Minecraft member name survives** anywhere.
* `tools/verify_links.py` - every distinct Minecraft member reference in the jar (77 of them
  across 20 Minecraft classes) is looked up in a real SRG-named Minecraft 1.8.9, walking
  superclasses and interfaces the way the JVM does. It also flags any *method declared on a
  Minecraft class but reached through a Forge subclass* that still carries its readable name -
  the case that bit `ClientCommandHandler.registerCommand`, which a remapper only renames if it
  can see the inheritance. That one would have loaded the mod and then thrown
  `NoSuchMethodError` at init; it is now caught at build time, and the check was validated
  against a deliberately mis-remapped jar. This is the closest available stand-in for
  launching the game: a wrong name or descriptor would appear here as the `NoSuchMethodError` it
  would have become in play. It self-tests first - a fabricated member and a wrong descriptor
  must both fail to resolve - so it cannot pass vacuously.

## What the suite cannot cover

Honestly and specifically:

| Not covered | Why |
|---|---|
| GL capture (both paths) | needs a live GL context; no GPU or Minecraft client here |
| Asynchronous pixel-buffer readback | needs a driver; self-tests at runtime instead |
| FPS cost on a device | needs a phone; [BENCHMARKS.md](BENCHMARKS.md) says how to measure it |
| Forge event wiring, key bindings, the GUI screens | need a running client; references verified to link, behaviour not exercised |
| OptiFine interaction | needs the client |
| Clip playback in Android apps | needs a phone |

The first three are where remaining risk sits, and each has a fallback that is exercised by the
code rather than assumed: blit falls back to a direct read, asynchronous falls back to
synchronous, and repeated capture failures stop recording with a message instead of spinning.

## Adding a test

`src/test/java/com/pcpclip/test/` - add a class with a `static void run()`, call it from
`TestMain`, and use `TestSupport.check(...)`. `TestSupport.fillFrame(...)` makes a frame,
`Ffprobe.probe(...)` verifies a file externally (and returns null when ffprobe is absent, so the
suite still runs without it).
