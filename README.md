# PCP — Adaptive PvP Spacing & Trade Timing

A client-side **Minecraft 1.8.9 / Forge** mod that learns how the server you are
on actually behaves and uses that to make bounded, explainable movement and
attack-timing decisions: sprint resets (W-tap), small spacing corrections
(S-tap), and picking which tick a requested attack goes out on.

It does **not** promise invulnerability or guaranteed combos. Everything it does
is derived from measurements it can actually take, it reports its own confidence,
and it backs off when that confidence or the latency picture degrades.

Built and tested against **Forge 1.8.9-11.15.1.2318** with MCP mappings
`stable_22`. Java 8 bytecode, no lambdas, no external runtime dependencies —
which is also what makes it safe under **PojavLauncher**.

---

## 1. What it does

| Module | Behaviour |
| --- | --- |
| **Knockback learning** | Measures displacement, vertical pop, separation gain and reaction delay around every hit; keeps rolling per-server samples with a confidence number; detects when the rules change under you and decays stale samples. |
| **Latency awareness** | Tracks your server-reported ping, its jitter and its trend; measures how long your hits take to visibly land; estimates opponent latency only when it cannot read a real one. |
| **W-tap controller** | On a confirmed sprint hit, briefly stops asking for forward so 1.8.9's own sprint logic re-arms. Length scales with latency slack and measured knockback. Skipped entirely where the measured knockback is too small to be worth the lost pressure. |
| **S-tap controller** | Small bounded backward correction when the gap has collapsed or a swing is already in flight. Refuses to act when retreating cannot outpace the opponent's closing speed, or when it would push you out of range. |
| **Trade timing** | When you click, decides whether to send the attack now, hold it a few ticks, or let a movement correction land first. One click in, at most one attack out — never more, never fewer. |
| **Fight state machine** | Idle, Approach, Engagement, Combo, Trade, Recovery, Disengage, with dwell times, evidence-based transitions, safety overrides and a stuck guard. |
| **Spacing model** | Sorts the gap into six bands (far / edge / combo / danger / knockback-gap / walk-in-risk) against a *configurable* effective-range estimate, and projects the gap a few ticks ahead. |
| **Debug overlay** | Compact 9-line diagnostic panel, configurable corner, every number tagged as measured, estimated or prior. |
| **Controls** | Rebindable keys **and** a full `/pcp` command set, so it is completely usable with no keys bound (PojavLauncher). |

### Safety properties

- One movement action at a time — W-tap and S-tap cannot fight over the forward axis.
- Every duration is clamped to `[minTapTicks, maxTapTicks]`, enforced twice (planner and controller).
- A cooldown between actions, plus a direction-flip guard that prevents forward/back oscillation.
- Automation stops and all inputs return to you on: menu open, lost window focus, game paused, death, spectator mode, world change, disconnect, latency spike, master toggle off, or the suspend key.
- The mod never fabricates input you did not ask for: a W-tap only *releases* forward, and the attack gate only ever re-sends a click you made.

---

## 2. Build

Requires **JDK 8** (ForgeGradle 2.x will not run on a modern JDK) and network
access to `maven.minecraftforge.net`, `libraries.minecraft.net` and Mojang's
launcher CDN.

```bash
# from the repository root
export JAVA_HOME=/path/to/jdk8
./gradlew build                 # runs the self tests, then builds the mod
```

The first build also downloads and deobfuscates Minecraft, which takes about
30 seconds; later builds reuse it. `./gradlew setupCiWorkspace` does that step on
its own if you want it separated, and `./gradlew setupDecompWorkspace` is the
usual choice before importing into an IDE.

The result is **`build/libs/pcp-1.0.0.jar`**, reobfuscated and ready to install.

To run the tests alone:

```bash
./gradlew selfTest          # both suites
./gradlew coreTest          # decision logic, no Minecraft needed
./gradlew integrationTest   # against the real Forge/Minecraft classes
```

The decision core has no Minecraft dependencies, so it can also be exercised
with nothing but a JDK:

```bash
mkdir -p /tmp/pcp-core
javac -d /tmp/pcp-core src/main/java/dev/paxiyl/pcp/core/*.java \
                       src/test/java/dev/paxiyl/pcp/core/CoreSelfTest.java
java -cp /tmp/pcp-core dev.paxiyl.pcp.core.CoreSelfTest
```

### Why the build script re-points three URLs

ForgeGradle 2.1 is the only ForgeGradle line that accepts Minecraft 1.8.9 (2.2 is
gated to 1.9.4–1.11.2, 2.3 to 1.12+), and it still downloads Minecraft from
Mojang's retired `s3.amazonaws.com/Minecraft.Download` bucket, which has
returned **404** since Mojang moved to the launcher CDN. A stock 1.8.9 MDK
therefore cannot fetch Minecraft at all any more.

`build.gradle` fixes this in the cleanest available way: the download tasks
expose a settable `url`, so `getVersionJson`, `downloadClient`, `downloadServer`
and `getAssetIndex` are re-pointed at the current endpoints, using the object
hashes published in Mojang's own 1.8.9 manifest entry. The bytes are identical to
what ForgeGradle would have downloaded (verified by SHA-1). Nothing else is
patched — mappings, Forge and the Minecraft libraries all still resolve from live
Maven repositories.

---

## 3. Install

### Desktop

1. Install **Minecraft Forge 1.8.9** (11.15.1.2318 is what this was built against).
2. Drop `pcp-1.0.0.jar` into `.minecraft/mods/`.
3. Launch the Forge 1.8.9 profile. On first run the mod writes `config/pcp.cfg`.

### PojavLauncher (Android)

1. In PojavLauncher, install the **Forge 1.8.9** installer as usual and select
   the resulting Forge version in your profile.
2. Set the runtime to **JRE 8**. The mod is Java 8 bytecode with no
   `invokedynamic` anywhere, so it also loads cleanly on newer JREs if your Forge
   setup uses one.
3. Put the jar in `.minecraft/mods/` (via the launcher's file manager or any file
   app) and launch.

Things that were done specifically with Pojav in mind:

- **No keys required.** Default keys exist (H/J/K/G) but every function also has a
  `/pcp` subcommand, and `/pcp gui` opens the settings screen. Nothing is
  keyboard-only.
- **Touch-friendly settings screen** — full-width rows with `[-] [name: value] [+]`
  buttons rather than sliders or text fields.
- **Input is never forced through key states.** The mod wraps the player's
  `MovementInput` object and overrides a value on top of it, so Pojav's on-screen
  controls keep working exactly as they do without the mod, and dropping the
  override hands control back on the very next tick.
- **Rendering stays on vanilla paths** — `Gui.drawRect` and the vanilla font
  renderer only, with GL state restored afterwards. Nothing that gl4es struggles
  with, no custom shaders, no immediate-mode tricks.
- **Flat per-tick cost.** The target scan is throttled, bounded to the world's
  player list, and uses squared distances; overlay strings are composed once per
  tick, not per frame.

---

## 4. Controls

| Key (default) | Function |
| --- | --- |
| `H` | Master toggle |
| `J` | Toggle debug overlay |
| `K` | **Hold** to suspend all automation |
| `G` | Open the settings screen |
| unbound | Toggle W-tap / S-tap / trade timing |
| unbound | **Hold** for manual attack override (clicks pass straight through) |

All keys are rebindable in the vanilla Controls screen, under "PCP Adaptive Spacing".

### Commands

```
/pcp                       status summary
/pcp on | off              master switch
/pcp wtap|stap|trade|spacing|overlay  [on|off|toggle]
/pcp reach <blocks>        effective range estimate for this server (2.0-4.5)
/pcp learn <0.05-1.0>      learning aggressiveness
/pcp conf <0-0.95>         confidence required for corrections
/pcp taps <min> <max>      tap length bounds, in ticks
/pcp cooldown <ticks>      cooldown between actions
/pcp delay <ticks>         hard cap on attack holding (0 disables holding)
/pcp reset                 clear the learned knockback profile for this server
/pcp reload                re-read the config file
/pcp gui                   open the settings screen
```

---

## 5. Configuration guide

Config file: `config/pcp.cfg`. Every value is clamped on load, so a hand-edited
file cannot push the controller out of safe bounds. Learned profiles live in
`config/pcp/profiles/<server>.properties`.

### `general`

| Setting | Default | Meaning |
| --- | --- | --- |
| `masterEnabled` | `true` | Master switch. Off means nothing is touched at all. |
| `wTapAssist` | `true` | Allow brief forward releases for sprint resets. |
| `sTapAssist` | `true` | Allow brief backward spacing corrections. |
| `tradeTimingAssist` | `true` | Allow holding a requested attack for a few ticks. |
| `spacingAssist` | `true` | Enable the spacing model that drives S-taps. |
| `targetPlayersOnly` | `true` | Only other players count as opponents. |
| `chatFeedback` | `true` | One-line chat confirmations on toggles. |

### `movement`

| Setting | Default | Meaning |
| --- | --- | --- |
| `minTapTicks` | `1` | Shortest movement tap (1 tick = 50 ms). |
| `maxTapTicks` | `4` | Longest movement tap. Hard ceiling on any held input. |
| `actionCooldownTicks` | `6` | Ticks after an action ends before another may start. |
| `directionFlipGuardTicks` | `8` | Minimum ticks between opposite-direction actions. |
| `maxTradeDelayTicks` | `3` | Hard cap on attack holding. `0` disables holding entirely. |

### `spacing`

| Setting | Default | Meaning |
| --- | --- | --- |
| `effectiveRange` | `3.0` | **Per-server** effective attack range estimate, in blocks. Vanilla 1.8.9 resolves player hits at roughly 3.0, but server software and lag compensation move the practical value — tune this per server. |
| `comboBandFraction` | `0.72` | Fraction of effective range treated as the favourable combo band (2.16 blocks at defaults). |
| `dangerCloseFraction` | `0.55` | Below this fraction you are in a close-range trade (1.65 blocks at defaults). |
| `predictionTicks` | `3` | How far ahead the gap is projected. |
| `maxTargetDistance` | `7.0` | Opponents past this are ignored entirely. |

### `learning`

| Setting | Default | Meaning |
| --- | --- | --- |
| `learningAggressiveness` | `0.25` | `0.05` follows the long-run average, `1.0` follows the last few hits. |
| `minConfidence` | `0.35` | Confidence the profile must reach before automatic corrections run. See the risk ladder below. |
| `targetTimeoutTicks` | `40` | Ticks an opponent may go unseen before the engagement drops. |
| `stateStuckTicks` | `120` | Any non-idle state held this long without new evidence falls back to Idle. |
| `persistProfiles` | `true` | Save learned profiles per server between sessions. |

### `debug`

| Setting | Default | Meaning |
| --- | --- | --- |
| `debugOverlay` | `false` | Show the diagnostic overlay. |
| `overlayCorner` | `0` | 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right. |
| `overlayMargin` | `3` | Pixels from the screen edge. |

### The confidence risk ladder

`minConfidence` is not applied uniformly, because the interventions are not
equally risky:

- **A minimum-length W-tap** is allowed below the threshold. It only *releases* a
  key you are already holding, so the worst case is one tick of lost forward input.
- **Longer W-taps**, **any S-tap** and **any attack holding** require the
  threshold to be met. These either ask for input you did not give or delay
  something you did.

Raise `minConfidence` to make the mod more passive on a new server; lower it to
let it act sooner on less evidence.

---

## 6. Measured vs estimated — exactly which is which

This matters, so it is spelled out per value. The overlay tags each one
(`measured` / `msr`, `est`, `prior`).

| Value | Status | Source and caveats |
| --- | --- | --- |
| **Your ping** | **Measured** (by the server) | Read from `NetworkPlayerInfo.getResponseTime()`, the round-trip the server publishes in the player-list packet. Real, but refreshed only ~once per second — which is why jitter and trend are tracked rather than one value. Values of `0` or absurd values are rejected, not used. |
| **Your jitter / trend** | **Measured** | Standard deviation and recent-vs-window mean of the above samples. |
| **Hit response time** | **Measured locally** | Ticks between sending an attack and seeing the target react. Contains your round trip *plus* server tick granularity, so it is reported separately and never presented as a ping. |
| **Opponent ping** | **Measured only when the server exposes it** | Taken from their player-list entry when present and plausible; the overlay then says `server-reported`. Many servers hide, zero or fake this. |
| **Opponent latency (fallback)** | **Estimated** | Derived from how far apart their position updates arrive, halved because part of any gap is the server batching. Carries its own confidence and is always labelled `est`. **If there is not enough data, the overlay says `unknown` — no number is invented.** |
| **Knockback separation / displacement / vertical pop** | **Estimated from measurements** | Computed from the victim's observed displacement over the 4 ticks after a hit, and the change in separation versus the distance at the moment of attack. Reported as a blend of the measurement and a vanilla-reference prior, weighted by sample count and consistency. |
| **Knockback values before any hits** | **Prior, not measured** | Vanilla-1.8.9-like reference numbers (derived from the vanilla impulse: ~0.4 horizontal, +0.5 for a sprint hit, 0.4 vertical cap). Confidence is ~0 and the overlay says `prior`. |
| **Server knockback configuration** | **Never known** | The client is not told it. Nothing in this mod claims to read it. |
| **Hit confirmation** | **Inferred from evidence** | A rising hurt timer or a health drop on the entity we just attacked, inside a 6-tick window. A third party hitting the same opponent in that window is indistinguishable from here — which is why samples are rolling, confidence-weighted, and runs that do not fit the distribution are detected and decayed rather than trusted. |
| **Opponent's swing** | **Measured** | `isSwingInProgress` is driven by a server animation packet, so "they have attacked" is real evidence, not a guess. |
| **Your backward speed** | **Estimated** | Taken from your observed horizontal speed, clamped to plausible on-foot values. Potions, ice and server movement handling all change it and none of that is directly readable. |

---

## 7. How it works on 1.8.9 specifically

Two implementation details are worth knowing, because both were verified against
the actual decompiled 1.8.9 Forge classes rather than assumed.

**Movement.** The mod wraps `EntityPlayerSP.movementInput` in a delegating
`MovementInput` instead of forcing key states. The delegate still computes the
player's real input (which is what every decision is based on), and an override is
applied on top only while an action is running. A W-tap therefore just stops
asking for forward — 1.8.9's own `onLivingUpdate` drops the sprint when forward
falls below `0.8` and re-arms it when the player's input returns, so the sprint
reset is done by vanilla logic, not simulated. Dropping the override restores
player control on the next tick with nothing to clean up.

**Attack gating.** Inside `Minecraft.runTick()`, Forge fires its input events
(`fireMouseInput` at bytecode offset 623, `fireKeyInput` at 1439) *before* the
vanilla loop that drains `keyBindAttack.isPressed()` and calls `clickMouse()` at
offset 1798. Taking the queued press in an input handler is therefore strictly
earlier than vanilla would act on it, and re-issuing it in the same handler
attacks on the same tick with **no added latency**. Release goes through the
ordinary client attack path — `swingItem()` then
`PlayerControllerMP.attackEntity` — which is exactly what `clickMouse()` does for
an entity. Clicks are only ever intercepted while the crosshair is on a living
entity, so block breaking, item use and GUI clicks are untouched.

Note that `AttackEntityEvent` is **not** fired on the client in 1.8.9 (it is only
referenced by `ForgeHooks` on the server side), so attack detection comes from the
input path above rather than from that event.

**Decision timing.** The decision pass runs at the *end* of the client tick, after
`theWorld.updateEntities()` has applied this tick's positions, hurt timers and
knockback velocities, so the snapshot reflects what really just happened. The
resulting override is read on the next tick — a one-tick turnaround, which is the
minimum achievable without rewriting vanilla methods.

### Code layout

```
src/main/java/dev/paxiyl/pcp/
├── PcpMod.java              mod entry point, event-bus registration
├── core/                    decision logic — no Minecraft imports at all
│   ├── CombatBrain          per-tick orchestrator
│   ├── CombatSnapshot       everything the core may know about one tick
│   ├── FightStateMachine    the 7 states, dwell times, stuck guard
│   ├── SpacingModel         distance bands and projection
│   ├── TapPlanner           W-tap / S-tap selection and durations
│   ├── TradeDecider         attack now / hold / reposition
│   ├── KnockbackProfile     rolling per-server learning + confidence
│   ├── LatencyModel         measured vs estimated latency
│   └── RollingStats         windowed statistics
├── client/                  the adapter layer
│   ├── PcpClient            per-tick pipeline, all Forge event handlers
│   ├── TargetTracker        opponent selection and engagement geometry
│   ├── HitObserver          hit confirmation and knockback measurement
│   ├── LatencyMonitor       player-list ping polling
│   ├── MovementController   single-owner action execution
│   ├── AdaptiveMovementInput  the delegating input wrapper
│   ├── AttackGate           click interception and release
│   ├── SafetyGuard          one place that answers "may we act?"
│   ├── DebugOverlay         render-only overlay
│   ├── ProfileStore         per-server profile persistence
│   └── PcpCommand           /pcp
└── config/                  config file, settings screen, Forge GUI factory
```

---

## 8. Test results

Two suites, **303 checks, 0 failures**, both run automatically as part of
`./gradlew build`.

### Core decision logic — `./gradlew coreTest` (211 checks)

Pure logic, no Minecraft on the classpath.

| Area | What is covered |
| --- | --- |
| Rolling statistics | Window eviction, NaN/infinity rejection, confidence vs spread, half-window decay. |
| Knockback priors | Untrained values are the prior and report zero confidence; trained values converge on the measurement; buckets stay independent; low-knockback servers are learned as such; reset returns to the prior. |
| Regime change | A sustained run of out-of-distribution samples is detected and the window decays; stable behaviour never triggers it. |
| Persistence | Save/load round trip preserves counts and estimates; corrupt entries are skipped rather than fatal. |
| Latency | Measured vs estimated separation; implausible pings rejected; hidden opponent ping never turned into a number; spike detection and expiry; stale player-list data treated as unreliable; slack bounded. |
| Spacing | All six zones including knockback-gap and walk-in-risk; stale and mis-aimed swings rejected; projection pulling a safe gap into the danger band; bands move with configured range. |
| State machine | Full approach→engage→combo→trade→cooldown path; hit-taken bypasses dwell into Recovery; losing exchange disengages; target loss and out-of-range both return to Idle; stuck guard fires. |
| W-tap | Issued on a confirmed sprint hit; one tap per hit; duration bounds; latency slack widens the window; skipped on measured-low knockback; never fires without player forward intent, without a sprint, or while sneaking; module and master switches respected; stops on unreliable latency. |
| S-tap | Confidence gate; bounded duration; refuses hopeless retreats; refuses to overshoot out of range; not applied while the player is already backing off. |
| Bounds | Cooldown enforced and expiring; direction-flip guard; mis-ordered or absurd config values self-correct. |
| Trade timing | Manual override, module off, suspended, unreliable latency, low confidence, being hit, and a ready sprint hit all send immediately; range-closing, in-flight swing, knockback gap and active correction all hold; refuses to wait when range would be lost. |
| Fuzz: delay cap | 28,000 randomised decisions across every cap value 0–6 — the cap is never exceeded and an "attack now" never carries a delay. |
| Fuzz: whole fight | 20,000 randomised fight ticks with toggles and suspensions flipping — no action ever exceeds its duration bounds, violates the cooldown, flips direction inside the guard, runs while off/suspended/idle, or runs on unreliable latency. |
| Controller lifecycle | Idle controller does not override; running actions are not pre-empted; over-long plans are clamped; disabling mid-action restores player control immediately; completed taps release themselves. |

### Forge integration — `./gradlew integrationTest` (92 checks)

Runs against the real Forge and Minecraft classes, with no window and no OpenGL
context. This is what catches API misuse that compilation alone cannot.

| Area | What is covered |
| --- | --- |
| Forge config system | A real `Configuration` load creates the file; every documented default is verified through it; all 23 settings survive a save and a re-read into a fresh object; `reload()` picks up on-disk changes. |
| Config robustness | A hand-edited file with `effectiveRange=99`, `maxTapTicks=500`, `maxTradeDelayTicks=120` and `minConfidence=5.0` is clamped back into range on load, and the distance bands stay correctly ordered. |
| Profile persistence | Real file IO: save, reload, learned value and sample count preserved, unknown servers load cleanly as "no data", delete works and deleting twice is harmless. |
| **Movement wrapper** | Against the genuine `net.minecraft.util.MovementInput`: transparent when idle (forward, strafe, jump and sneak all pass through); the player's true intent is what reaches the snapshot even while an override is active; a W-tap zeroes forward and touches nothing else; an S-tap applies backward input; the override is sneak-scaled exactly as vanilla scales player input; releasing restores the player's input on the next update. |
| Key bindings | Real `KeyBinding` objects: the four defaults are bound, module keys start unbound, an unbound key is never treated as held, all share one category. |
| Null safety | Safety guard blocks on a null client; the hit observer survives a null player and null world (which is what happens between world loads); the overlay composes safely with no GL context and `render(null)` is a no-op. |

Build verification performed here:

- `./gradlew build` succeeds; `build/libs/pcp-1.0.0.jar` is produced.
- The jar is correctly reobfuscated — e.g. `EntityPlayerSP.movementInput` appears as `field_71158_b` — so it is a production jar, not a dev-only one.
- All classes are major version **52** (Java 8) and the jar contains **zero** `invokedynamic` instructions.
- Every Minecraft and Forge API used was checked against the decompiled 1.8.9 jar with `javap` before being written, including the `runTick` bytecode ordering that the attack gate depends on.
- Two assumptions were checked and corrected as a result: `AttackEntityEvent` does **not** fire client-side in 1.8.9 (so attack detection uses the input path instead), and `FMLCommonHandler.instance().bus()` is the *same object* as `MinecraftForge.EVENT_BUS` in this version (so one registration covers everything, with no double-firing).

### Bugs the tests actually caught

Worth listing, since they are the reason the suites exist:

1. **The stuck guard pinned the state machine in Idle.** Because `Idle` is the resting state, after `stateStuckTicks` of quiet the guard re-asserted Idle every tick and never updated its timestamp — so no fight could ever be picked up again after ~6 seconds of calm. The guard now only ever fires *out of* a non-idle state.
2. **Regime detection could never trigger.** Outliers were compared against a window they had already polluted, which inflated its spread and hid them. It now freezes a baseline when a run starts and requires a sustained run against that baseline.
3. **A confident low measurement still read high.** Value reporting and action gating shared one confidence number, so a well-measured low-knockback server never looked low enough to skip W-tapping. Blend weight and action confidence are now separate quantities.
4. **The S-tap gate consulted the wrong bucket.** It keyed off the last hit's sprint state, so a profile trained on sprint hits left S-tap permanently blocked. It now uses the profile's overall confidence.

---

## 9. Limitations and known gaps

- **Not play-tested in live PvP, and the game client was never launched here.**
  A launch was attempted under Xvfb: LWJGL 2.9.4 aborts in
  `LinuxDisplay.getAvailableDisplayModes` with an empty mode list
  (`ArrayIndexOutOfBoundsException: 0`) because this container has no GPU and its
  X server advertises no display modes. That crash happens in
  `Minecraft.setInitialDisplayMode`, *before* FML loads any mods, so it says
  nothing about the mod — but it does mean mod discovery, `preInit`/`init`, and
  the live tick loop were not observed running. Everything reachable without a
  window **was** exercised (see the integration suite). Treat the defaults as a
  starting point and tune `effectiveRange` and `minConfidence` on a private
  server first.
- **Hit attribution is ambiguous by nature.** If someone else hits your opponent
  within 6 ticks of your attack, that looks identical from the client. This is
  handled statistically (rolling samples, confidence, regime detection), not
  solved.
- **Opponent ping is frequently unavailable.** Many servers hide or fake the
  player-list value; the fallback is an estimate from update cadence and is
  labelled as such.
- **One-tick decision turnaround** on movement, as explained above. Removing it
  would require rewriting vanilla methods (ASM/Mixin), which this mod deliberately
  does not do.
- **`leftClickCounter` divergence.** Vanilla suppresses an attack for up to 10
  ticks after creative block breaking. The gate does not replicate that check, so
  clicking an entity immediately after breaking a block in creative can attack
  where vanilla would not. Harmless in PvP, noted for completeness.
- **Single opponent.** The model tracks one engagement at a time; in a group
  fight it follows your crosshair.
- **No anti-cheat evasion, no packet spoofing, no timer manipulation.** None of
  that is present, and adding it is not a goal.

### Server rules

Movement and attack-timing automation is prohibited by many servers' rules even
though this mod uses only normal client input paths. That is a rules question, not
a technical one — check what the server you play on allows, and use the suspend
key or `/pcp off` where it does not. Test on a private or authorised server first.
