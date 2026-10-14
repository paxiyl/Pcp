# Troubleshooting

Almost everything PcpClip can go wrong at is reported in two places: a brief on-screen message,
and a line in the Minecraft log prefixed `[PcpClip]`. The log is the one to keep.

## Where to look first

**Settings -> Performance** shows the live picture:

```
Buffering   captured 29.4 fps of 30   dropped 0.4%   queue 0
readback 1.84 ms/frame on the render thread   encode 27 ms/frame
Motion JPEG (ImageIO, q55) (software)
```

| Field | What it tells you |
|---|---|
| `captured X of Y` | the frame rate really being captured against the target. These differing is normal when the game renders fewer frames than the target. |
| `dropped` | captures that could not be buffered. Anything above a few percent means the preset is beyond the device. |
| `queue` | frames waiting to be encoded. A steadily growing queue means the encoder is behind. |
| `readback` | cost per frame on the render thread. **This is the FPS cost.** |
| `encode` | cost per frame on a worker thread. Does not cost FPS directly, but competes for CPU. |
| last line | the encoder actually in use, and whether the performance saver has stepped in. |

**Settings -> Storage** shows the clip folder, free space, and the size of the buffer cache.

`/pcpclip status` prints the same figures into chat, which is easier to screenshot or copy into a
bug report than a settings screen.

At startup the log records what the environment can do; that block answers most questions:

```
[PcpClip] renderer probe | GL ... | ... | ...
[PcpClip] renderer probe | framebuffer objects: yes, game framebuffer in use: yes, max texture 8192
[PcpClip] renderer probe | pixel buffer objects advertised: no
[PcpClip] encoder probe  | Motion JPEG: available (JRE JPEG writer)
[PcpClip] encoder probe  | H.264/MP4: available (JCodec, software)
[PcpClip] encoder probe  | Hardware: unavailable - ...
[PcpClip] capture pipeline up: Motion JPEG (ImageIO, q55), 1280x720 target 30 fps, GPU scaling, ...
```

For more detail, set `general.debugLogging=true` in `config/pcpclip.cfg`.

---

## Encoder problems

### "No video encoder is available in this runtime"

Both backends failed to initialise. The `encoder probe` lines say which and why.

* *H.264/MP4: UNAVAILABLE - JCodec classes are not on the classpath* - the jar was repacked
  without `org/jcodec/**`. Reinstall the released jar.
* *Motion JPEG: UNAVAILABLE - this JRE has no JPEG writer* - the runtime has no ImageIO JPEG
  plugin. Unusual; switch to a standard JRE in PojavLauncher's runtime settings.

### "Recording stopped: ..." with an encoder error

The encoder threw mid-segment. The segment is abandoned, everything already written stays
clippable, and recording stops instead of writing broken video. The log line above the message
has the exception. Then: lower the resolution, or switch the encoder, and report the exception.

### Clips are much shorter than requested

Expected for H.264 in the other direction (clips can be slightly *longer*). Shorter means the
buffer did not hold what you asked for:

* the buffer had not been running long enough yet - check `buffer X/Ys` on the main screen,
* or **Clip length** is longer than **Buffer**, which the settings screen warns about,
* or frames were dropped heavily, so fewer seconds of real frames exist than wall-clock seconds.

### A clip plays too fast, too slow, or jerkily

Clips carry real timestamps, so a variable capture rate plays back at the right *speed* but with
uneven motion. To force even motion, turn on **Fixed rate** - which works for Motion JPEG, where
frames can legitimately be duplicated. For H.264 the export reports the flag as not applied
rather than faking it; use Motion JPEG if you need a constant-rate file.

### H.264 is selected but Motion JPEG is used

The automatic choice decided software H.264 could not sustain the preset, and said so in the log.
Either accept it, pick **H.264/MP4** explicitly (and accept dropped frames), or lower the preset
until H.264 fits.

---

## Renderer problems

### "Recording stopped: the renderer refused to hand over frames."

Five consecutive capture failures. The log has the GL exception. PcpClip will have already tried
its fallbacks: framebuffer blit -> direct read, asynchronous -> synchronous.

Things to try, in order:

1. Make sure **Options -> Video Settings** has the framebuffer path enabled (vanilla's *Use VBOs*
   and OptiFine's *Fast Render* are unrelated, but a renderer with framebuffers disabled forces
   the slower direct read).
2. Set `performance.asyncReadback=false` in the config to rule out pixel buffer objects.
3. Lower the resolution below `max texture` from the renderer probe.
4. Report the probe block and the exception.

### Clips are black, or a solid colour

The readback happened but the frame was empty. Known causes:

* an output larger than the renderer's maximum texture size - the probe line reports the limit,
  and the mod falls back to a direct read, but a renderer may still misbehave;
* a renderer where the game's framebuffer texture is not readable. Set
  `performance.asyncReadback=false` first; if it persists, this is worth reporting with the
  probe block.

### Clips are upside down

Fixed in 1.0.1. Version 1.0.0 flipped every frame vertically - the hotbar appeared at the top of
the picture and the sky at the bottom. Update the jar; there is no setting for it and no way to
rescue an already-saved clip except to re-encode it yourself (`ffmpeg -i clip.avi -vf vflip
fixed.avi`).

### A clip contains only one frame

Fixed in 1.0.1, and only happened with **async readback** enabled (which is now off by default).
The capture path handed every frame the same timestamp, so the rolling buffer never rotated a
segment and a fixed-rate export collapsed the whole clip onto a single time slot.

If you see it on 1.0.1 or later, the pipeline will have corrected and counted it: open
**Settings -> Performance** and look for *"N capture timestamps had to be corrected"*, or run
`/pcpclip status`. Please report that number together with the probe block - it means the capture
layer is still misbehaving, even though the clip survived.

### The recording dot appears inside my clips

It should not: the indicator is drawn after the frame is captured, specifically so it does not.
If it does appear, something is drawing it earlier - report it. **Performance -> Dot: off**
removes it meanwhile.

### Recording stops when I rotate the phone

Rotating changes the framebuffer size. If that changes the *encoded* size (only when the aspect
is **Match device screen**, or a custom size no longer fits) the pipeline is rebuilt and the
buffer is cleared, because a clip cannot contain two different frame sizes. With a fixed aspect
preset the encoded size does not change and only the crop moves, which costs nothing. Pick a
fixed aspect ratio if you rotate often.

---

## Storage problems

### "Cannot record: ... is not writable"

The clips folder cannot be created or written. On Android this is usually a game directory on
storage the app cannot write. Check the path on the storage screen, then set
`storage.clipDirectory` to somewhere inside PojavLauncher's own storage.

### "Cannot record: only N MB left (minimum is 512 MB)"

Free space is below the floor. Free space, or lower `storage.minFreeSpaceMb` - knowing that the
floor exists so that a recording does not fill the device.

### "Storage is nearly full; recording stopped."

Space ran out while recording. Everything written before that point is still clippable: stop
recording, and the clip is written from what exists.

### "Not enough storage for a N MB clip"

The buffer holds more than will fit alongside the free-space floor. Save a shorter clip, or free
space. The video settings screen estimates clip size for the current preset up front.

### Clips do not show up in the Android gallery

Expected, in two ways:

* **AVI** is often not indexed or playable by the gallery. VLC and MX Player open it. Use
  **H.264/MP4** if you want gallery and chat-app support.
* The media scanner does not know about new files until it rescans. Opening the file from a file
  manager always works; **Storage -> Copy clips path** gives you the path.

### The buffer cache keeps growing

It should not: it is bounded by buffer length and by a byte cap. If `pcpclip/cache/` is large
while nothing is recording, a previous session was interrupted - **Storage -> Recover
interrupted** saves it as a clip, and **Clear buffer cache** discards it.

---

## After a crash

Segments are flushed to storage as each one finishes, so a crash, a force-close or a flat battery
leaves a recoverable recording rather than nothing.

1. Relaunch, open **Settings -> Storage**.
2. If anything is recoverable the screen says so: *An interrupted recording is in the cache: N
   segments, M frames.*
3. **Recover interrupted** writes it out as a normal clip.

Unfinished exports are cleaned up automatically on the next launch: a clip only takes its real
name once it is complete, so a half-written file never appears in the clip list.

## Reporting a problem

Include:

1. the `renderer probe`, `encoder probe` and `capture pipeline up` lines from the log,
2. the **Performance** screen's three status lines,
3. device, Android version, PojavLauncher version, renderer, and whether OptiFine is installed,
4. your `config/pcpclip.cfg`,
5. the `.pcpinfo` file next to a clip, if the problem is about a clip - it records what was asked
   for, what was captured and how much was dropped.
