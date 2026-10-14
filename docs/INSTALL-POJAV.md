# Installing on PojavLauncher

## What you need

* PojavLauncher (any recent build), with a working **Minecraft 1.8.9 + Forge** profile
* About 10 MB for the mod, plus room for clips (see [storage](#storage-and-where-clips-go))
* Nothing else. No second recording app, no root, no Zink, no FFmpeg, no desktop launcher.

## 1. Set up Forge 1.8.9

If you already launch 1.8.9 with Forge, skip to step 2.

1. In PojavLauncher, install the Minecraft **1.8.9** version first and run it once, so the
   version files exist.
2. Install **Forge 1.8.9** (`11.15.1.2318` is the last 1.8.9 build and the one this mod targets).
   PojavLauncher can run the Forge installer, or you can import an already-installed Forge
   profile. Launch the Forge profile once and let it reach the main menu.
3. Confirm the version list shows a Forge 1.8.9 profile and that the main menu says "Forge" in
   the corner.

OptiFine HD U M5 for 1.8.9 can be installed alongside; see
[COMPATIBILITY.md](COMPATIBILITY.md).

## 2. Drop in the jar

Copy `pcpclip-1.0.0-1.8.9.jar` into the `mods` folder of your 1.8.9 instance. On most
PojavLauncher layouts that is:

```
/storage/emulated/0/games/PojavLauncher/.minecraft/mods/
```

If your instance uses a separate game directory, use that instance's `mods` folder instead. The
folder may need creating; Forge also creates it on first launch.

Any Android file manager works. In PojavLauncher you can also use the built-in file manager
(**Settings -> File manager**, or the folder button on some builds).

## 3. Launch and check

Start the Forge 1.8.9 profile. Then either:

* open **Mods** on the title screen - *PcpClip* should be listed; or
* read the log (PojavLauncher shows it while launching) for a line like

```
[PcpClip] PcpClip 1.0.0 loaded; rolling buffer is off, clips go to /storage/.../pcpclip/clips
```

On the first frame after you join a world it also logs what your renderer can do:

```
[PcpClip] renderer probe | GL 2.1 gl4es wrapper | GL4ES wrapper | ptitSeb
[PcpClip] renderer probe | framebuffer objects: yes, game framebuffer in use: yes, max texture 8192
[PcpClip] renderer probe | pixel buffer objects advertised: no
[PcpClip] encoder probe | Motion JPEG: available (JRE JPEG writer)
[PcpClip] encoder probe | H.264/MP4: available (JCodec, software)
[PcpClip] encoder probe | Hardware: unavailable - the game JVM has no android.media.MediaCodec ...
```

Keep that block if you ever need to report a problem; it answers most questions on its own.

## 4. Turn on instant replay

The rolling buffer ships **off**, so that installing the mod costs nothing until you ask for it.

1. Press **F9** (or bind *Open PcpClip menu* to an on-screen button).
2. Tap **Instant replay buffer: Off** so it reads **On**.
3. Set **Buffer** (how much recent gameplay is kept) and **Clip length** (what the save key
   writes). 30 s of each is a good start.
4. Close the menu. The small blue **BUF** dot means the buffer is live.
5. Play. When something good happens, press **F6**. A message confirms the save without pausing
   the game.

## 5. Bind the keys to on-screen buttons

Physical F-keys are rare on a phone. Minecraft's own **Options -> Controls** screen lists all
four PcpClip actions under *PcpClip*, so:

* **In Minecraft**: rebind them to keys you have, or
* **In PojavLauncher's control editor**: add a button and give it the keycode you bound
  (F6-F9 by default). This is the normal way to get a "clip it" button on screen.

## Storage and where clips go

```
<game directory>/pcpclip/clips/     finished clips (.mp4 or .avi) plus a .pcpinfo detail file
<game directory>/pcpclip/cache/     the rolling buffer's segments; cleared when the buffer stops
```

* **Storage -> Copy clips path** puts the full path on the clipboard, which is the reliable way
  to find it from a file manager or paste it into a share dialog. A JVM inside PojavLauncher
  cannot hand a folder to an Android file manager directly, so the mod does not pretend to.
* Clips are named `pcpclip-<date>-<time>-<world or server>.mp4`, so they sort by time.
* PcpClip refuses to start recording when free space is below the configured floor (512 MB by
  default) and stops if space runs out mid-recording.
* To put clips somewhere else, set `storage.clipDirectory` in `config/pcpclip.cfg`. Paths are
  edited in the file rather than typed in game, because typing a path on a touch keyboard while
  a game runs is miserable.

### How much space a clip takes

720p30 Motion JPEG is roughly **1.1 MB per second** (about 34 MB for a 30 s buffer); 720p30
H.264 is roughly **0.9 MB per second**. The video settings screen shows the estimate for your
exact preset, and the storage screen shows what you have left.

## Playing clips back on the phone

* **MP4 (H.264)** plays in the Android gallery, in every player, and uploads to any app.
* **AVI (Motion JPEG)** plays in VLC and MX Player. The stock gallery often will not open it, and
  chat apps may refuse it. If you want to share directly, choose the H.264/MP4 encoder - at a
  resolution your device can sustain.

## Uninstalling

Delete the jar from `mods/`. Clips in `pcpclip/clips/` are left alone; `pcpclip/cache/` can be
deleted freely.
