# PcpClip

Instant replay and clipping for **Minecraft 1.8.9 Forge**, built for **PojavLauncher on Android**.

Press one key, get the last 15, 30, 60 or 120 seconds of gameplay as a video file. No second
recording app, no root, no Zink, no desktop launcher, no FFmpeg binary.

Built so that it costs as little as possible while it runs, and nothing at all while it is off.

```
dist/pcpclip-1.0.0-1.8.9.jar     drop into .minecraft/mods
```

---

## What it does

* **Rolling buffer (instant replay).** Keeps the recent past as short, already-encoded video
  segments on disk. One hotkey writes the last N seconds to a clip.
* **Manual recording** with start, pause, resume and stop.
* **Resolutions**: 360p, 480p, 720p, 1080p, or custom dimensions.
* **Frame rates**: 15 to 240, with 30, 60 and 120 as presets.
* **Aspect ratios**: 16:9, 21:9, 32:9, 4:3, 1:1, 9:16, match-your-screen, or custom - including
  2520x1080 ultrawide at 1080p height. Nothing is ever stretched: you choose between cropping and
  black bars, and both scale the picture uniformly, so the HUD, crosshair, hotbar, text and
  inventory keep their proportions.
* **MP4 (H.264)** or **AVI (Motion JPEG)** output, chosen automatically or by hand.
* **Clip history** screen with sizes, durations, the frame rate actually captured, and a
  copy-path button.
* **Crash recovery**: segments left behind by a crash or a killed app can be saved as a clip.
* A tiny recording dot that can be moved or switched off - and that never appears inside clips.

## Default settings, and why

| Setting | Default | Reason |
|---|---|---|
| Rolling buffer | **off** | It is the only always-on cost. Turn it on when you want it. |
| Resolution | 720p | Software encoding on a phone sustains this; 1080p often does not. |
| Frame rate | 30 | The frame rate most Android devices can actually render while recording. |
| Encoder | automatic | H.264/MP4 when the device can keep up, Motion JPEG when it cannot. |
| Fit | crop | Fills the frame; the alternative is black bars. Neither distorts. |
| Performance saver | on | Steps capture down when the game struggles, then back up. |
| Capture memory | 48 MB | Bounds the pipeline: a slow encoder drops frames, it never grows. |
| Audio | not available | See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). |

## Hotkeys

| Key | Action |
|---|---|
| F6 | Save the last *clip length* seconds |
| F7 | Save again with the same length |
| F8 | Start / stop manual recording |
| F9 | Open the PcpClip menu |

All four appear in Minecraft's own **Controls** screen under *PcpClip*, so they can be rebound -
including onto PojavLauncher's on-screen buttons, which is how most Android players will use them.

## Install

See [docs/INSTALL-POJAV.md](docs/INSTALL-POJAV.md). Short version: Forge 1.8.9 profile in
PojavLauncher, drop the jar in `mods/`, launch, press F9.

## Build

Two routes produce the same jar.

```bash
# 1. ForgeGradle (the conventional route; needs Gradle 2.14, a Java 8 JDK and Forge's maven)
gradle setupCIWorkspace
gradle build

# 2. Without ForgeGradle (needs only Mojang's client jar and the published MCP mappings)
tools/bootstrap-devenv.sh      # fetches JDK 8, the 1.8.9 client, MCP mappings, SpecialSource
tools/build-jar.sh             # compiles, bundles JCodec, remaps MCP names to Forge's SRG names
```

Route 2 exists because Forge's maven was not reachable from the environment this mod was
developed in, and it is the route that was actually used and verified here. Details in
[docs/BUILDING.md](docs/BUILDING.md).

```bash
tools/run-tests.sh             # 1274 assertions, writes real clips, verifies them with ffprobe
tools/run-tests.sh bench       # per-frame encoder cost for every preset
```

## Honest limitations

The things worth knowing before you install it:

* **Audio is not supported.** Not "coming later" - there is no permission-compliant way to reach
  either the game's mixer or Android's audio APIs from Pojav's game JVM.
* **No hardware encoder.** `android.media.MediaCodec` lives in the app's Android VM, not in the
  OpenJDK VM the game runs in. Encoding is software, which is why the presets are what they are.
  A seam exists if a launcher ever exposes a bridge.
* **1080p120 is selectable but will drop most of its frames** on current phones. The settings
  screen says so before you choose it, and every clip records the frame rate that was really
  captured next to the one that was asked for.
* **H.264 clips are trimmed to a segment boundary** (up to 2 s longer than requested), because an
  H.264 clip has to start on a keyframe. Motion JPEG trims exactly.
* **On-device figures are not in this repository.** The encoder, muxer, buffer and engine are
  measured and tested here (see [docs/BENCHMARKS.md](docs/BENCHMARKS.md) and
  [docs/TESTING.md](docs/TESTING.md)); the FPS cost on a real phone, and the GL capture path
  itself, need a device. [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) marks exactly which is
  which.

## Documentation

| | |
|---|---|
| [docs/INSTALL-POJAV.md](docs/INSTALL-POJAV.md) | Installing on PojavLauncher, step by step |
| [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) | Compatibility table, tested vs theoretical, limitations |
| [docs/BENCHMARKS.md](docs/BENCHMARKS.md) | Measured costs, method, how to reproduce |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Diagnosing encoder, renderer and storage errors |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works and why it is built this way |
| [docs/TESTING.md](docs/TESTING.md) | What the test suite covers and what it cannot |
| [docs/BUILDING.md](docs/BUILDING.md) | Both build routes in detail |

## Licence

MIT; see [LICENSE](LICENSE). Bundles [JCodec](https://jcodec.org) under the FreeBSD licence for
the optional pure-Java H.264 encoder; see [NOTICE.txt](NOTICE.txt).
