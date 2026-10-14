# Compatibility, and what was actually tested

## The short version

PcpClip was developed and verified in a Linux build environment with no Android device and no
Minecraft client available. That has a clear consequence for how to read this document:

* Everything in **[Verified here](#verified-here)** was executed and measured - the encoders, the
  muxers, the rolling buffer, the whole engine, the built jar's runtime linkage.
* Everything in **[Needs a device](#needs-a-device)** is written against the real APIs and
  verified to link, but has not been run on a phone. That includes the GL capture path itself.

Nothing below is presented as measured unless it was measured.

## Target matrix

| Component | Target | Status |
|---|---|---|
| Minecraft | 1.8.9 | Required. `acceptedMinecraftVersions = [1.8.9]` |
| Mod loader | Forge 1.8.9 (11.15.1.2318) | Required. Client-side only |
| Java | 8 bytecode, runs on 8 and newer | Verified: tests run on JDK 8 |
| Launcher | PojavLauncher (Android) | Primary target |
| Renderer | GL4ES | Primary target; detected and adapted to |
| Renderer | VirGL / Zink | Should work; not required and not assumed |
| OptiFine | HD U M5 (1.8.9) | Expected to work; see below |
| Desktop Forge 1.8.9 | Windows / Linux / macOS | Expected to work; same code path |
| Root access | not needed | Never used |
| External recorder app | not needed | Never used |
| FFmpeg / native libraries | not bundled | Nothing native ships in the jar |

## Verified here

| What | How it was verified |
|---|---|
| Aspect-ratio geometry never distorts | 128 source, output and fit-mode combinations asserted to scale uniformly within one pixel of rounding ([TESTING.md](TESTING.md)) |
| 1080p 21:9 is exactly 2520x1080 | asserted |
| Settings survive a restart | written, re-read, compared field by field |
| Invalid settings are clamped and reported | out-of-range and unparseable values asserted |
| Rolling buffer stays bounded | bounded by duration and by bytes under a 40-segment run; pruned files really deleted |
| A crash mid-write loses only the damaged frame | file truncated mid-record, remaining frames still read |
| Clips are real video files | written by the real pipeline, then decoded frame by frame with `ffprobe`/`ffmpeg` |
| H.264 clips start on a keyframe | asserted, and every written frame decodes |
| Motion JPEG trims to the exact requested span | asserted against timestamps |
| Fixed-rate export fills slots by duplicating frames | asserted; refused for H.264 rather than faked |
| Paused time is excluded from a recording | asserted |
| An overloaded encoder drops frames instead of growing | 1080p120 through one software worker: 95% dropped, backlog <= 2 frames, heap growth bounded |
| A long session does not grow memory or storage | 11 s run against a 5 s buffer: cached bytes and segment count flat |
| A recording longer than the buffer keeps its start | 8 s recording against a 5 s buffer: whole recording saved, then pruning resumes |
| The clip-folder cap is opt-in and removes only the oldest | asserted; off by default |
| Encoder cost per preset | measured; see [BENCHMARKS.md](BENCHMARKS.md) |
| The built jar links against real Minecraft | all 69 distinct Minecraft references across 16 classes resolved against an SRG-named 1.8.9 client, with inherited lookup, by `tools/verify_links.py` |
| The jar is correctly reobfuscated | overridden methods and call sites checked to be SRG names; no readable Minecraft names remain |
| Inherited members reached through Forge types are remapped | checked, and the check validated against a deliberately mis-remapped jar |
| No compile-only stubs ship | asserted during the build |

## Needs a device

| What | Why it cannot be verified here | What it falls back to |
|---|---|---|
| GL capture (framebuffer blit) | needs a live GL context | direct framebuffer read |
| GL capture (direct read) | needs a live GL context | nothing below it; capture stops and says so |
| Asynchronous readback (pixel buffer objects) | needs a driver | **off by default**; self-tests, then synchronous reads |
| FPS cost of recording on a phone | needs a phone | performance saver adapts at runtime |
| OptiFine interaction | needs the client | no OptiFine classes are touched |
| Forge event wiring | Forge's jars were unreachable (see [BUILDING.md](BUILDING.md)) | small, stable API surface; see `stubs/java/README.md` |
| Clip playback in Android apps | needs a phone | MP4 for sharing, AVI for players |

## What the first device clips changed

Two clips captured on a real device (720p Motion JPEG, PojavLauncher) exposed two faults that
every test here had passed straight over. Both are fixed, and both now have tests that would have
caught them:

* **Frames came out upside down.** The conversion step flipped vertically on both the source and
  the destination side, and the two cancelled. Every existing test fed synthetic frames in and
  read them back out, which proves the pipeline is self-consistent but says nothing about which
  way up it is. `OrientationTests` now paints a known colour in each corner of the source and
  insists on finding it in the right corner of the *decoded* output - for Motion JPEG and H.264,
  cropped and letterboxed.
* **Each clip held exactly one frame.** The asynchronous readback re-armed itself with a
  timestamp it had just overwritten, so every frame claimed the same instant. Segment rotation
  waits on presentation time, so it stopped rotating; the fixed-rate export samples onto a time
  grid, so a single frame filled the whole grid. Fixed at source, and the pipeline no longer
  depends on the capture layer being well behaved: a timestamp that does not advance is nudged
  forward by one frame interval and counted, segments rotate on wall clock as a backstop, and an
  export whose timestamps never advance writes every frame on a synthetic timeline and says so.

Asynchronous readback is now **off by default** as a result. It is a real saving when it works,
but it cannot be tested without a device, and correct capture matters more than fast capture.

## The two findings worth knowing

### Audio is not available

Not postponed - unavailable, for two separate reasons:

* **Game audio.** Minecraft 1.8.9 plays sound through Paul Lamb's sound library over OpenAL.
  There is no supported point at which a mod can tap the mixed output, and Pojav's OpenAL is a
  native library whose output buffer is not exposed to the JVM.
* **Device audio.** `android.media.AudioRecord` and friends live in the Android app's ART VM.
  The game runs in a separate OpenJDK VM; `android.*` classes are not on its classpath.
  Capturing other apps' audio output would additionally need permissions Pojav does not hold.

So the setting is absent rather than present-and-broken, `audio.enabled` is forced back to false
by validation, and clips are video only.

### There is no hardware encoder to use

The same VM boundary applies to `android.media.MediaCodec`: it is in the Android VM, and the mod
runs in the game's JVM. Reaching it needs a native bridge compiled against Android's JNI surface
and loaded on the launcher side. Guessing at an `.so` and shipping it is exactly the kind of
incompatible native blob to avoid, so PcpClip does not.

What it does instead:

* probes honestly at startup and logs the reason (`HardwareEncoderProbe`),
* exposes a seam - `HardwareEncoderBridge`, selected with
  `-Dpcpclip.hardwareBridge=<class name>` - so that a launcher or companion plugin could supply
  one without the mod changing,
* encodes in software, and sizes its automatic presets for software speeds.

If `android.media.MediaCodec` ever *is* visible from the game JVM, the probe notices and says so
in the log rather than silently ignoring it.

## OptiFine

Expected to work, and deliberately so:

* No OptiFine class, field or method is referenced.
* No rendering hook is installed. Capture happens at the end of Forge's render tick, after the
  frame is complete, and reads the game's framebuffer texture - the same object vanilla's own
  screenshot code uses.
* The game's framebuffer is never resized and its render path is never redirected, which is the
  usual way a recording mod breaks OptiFine. That is also why the custom-viewport fit mode is
  unavailable: changing the game's viewport mid-frame is the one approach that would break both
  OptiFine and GL4ES, so the mod crops and letterboxes instead.
* The one piece of OptiFine state PcpClip touches is the framebuffer texture's filter, which it
  sets to linear for its own draw and then puts back.

With OptiFine shaders, the composited result still lands in the main framebuffer, so capture
should behave the same. Untested.

## Other Forge mods

PcpClip registers one event handler object, four key bindings and no core-mod transformer, patches
nothing, and holds no Minecraft state. Conflicts are unlikely, with two predictable exceptions:

* another mod that already uses F6-F9 (rebind either; both appear in Controls),
* another recording mod capturing the same frames (both would pay the readback cost).

## Renderer notes specific to GL4ES

| Thing | Handling |
|---|---|
| `glReadPixels` formats | Only `GL_RGBA`/`GL_UNSIGNED_BYTE` is used - the one combination OpenGL ES guarantees. `GL_BGRA` is never requested, even though it would save a CPU swizzle. |
| `glGetTexImage` | Never used. Vanilla's screenshot code relies on it; PcpClip draws a quad and reads the result instead, which works on OpenGL ES semantics. |
| Pixel buffer objects | Detected, then self-tested with a real one-pixel readback and a real map, because GL4ES can advertise the extension and then refuse it. Any GL error disables it permanently for the session. |
| Framebuffer objects | Created through Minecraft's own `OpenGlHelper`, so whatever spelling (core, ARB, EXT) the renderer provides is used, with a completeness check and a fallback. |
| Immediate-mode GL | Not used. Drawing goes through Minecraft's `Tessellator`, so it works wherever the game itself works. |
| Maximum texture size | Queried; an output larger than the limit falls back to the direct-read path. |
| Screen rotation / resize | The framebuffer size is re-read every frame; a change in encoded size rebuilds the pipeline, and a change in crop alone costs nothing. |

## Crop versus fit, in practice

Cropping to an ultrawide shape removes the top and bottom of the rendered frame, and on a 16:9
source at 21:9 that is about a quarter of the height - which is where the hotbar and health bar
sit. Verified against a real capture: a 1280x720 frame cropped to 2520x1080 keeps rows 85 to 634
and the hotbar is gone.

That is the honest cost of filling an ultrawide frame, not a bug, and the video settings screen
now says so before you pick it. **Fit with bars** keeps the whole screen including the HUD, at
the price of black bars. Neither distorts anything.

## Known limitations

1. **No audio.** As above.
2. **No hardware encoding.** As above.
3. **1080p120 will drop frames** on current phones. Selectable, with a warning, and the clip
   records what was really captured.
4. **H.264 clips snap to a segment boundary**, so a clip can be up to one segment (2 s by
   default) longer than requested. Motion JPEG is exact.
5. **Fixed-rate export only applies to Motion JPEG.** Duplicating an H.264 frame is not valid
   without re-encoding, so the export reports the flag as not applied instead of pretending.
6. **AVI is not accepted everywhere on Android.** Use H.264/MP4 for sharing.
7. **The custom-viewport fit mode is unavailable** and falls back to letterbox, by design.
8. **Clip folders cannot be opened from in game**, only copied to the clipboard.
9. **Saved clips are never auto-deleted** by default (`storage.maxLibraryGb=0` would enable it);
   the mod warns about space instead of removing your clips.
10. **Capture pauses with the render loop.** If the game stops rendering (minimised, or the OS
    suspends it), no frames are captured for that period; timestamps reflect the gap.
