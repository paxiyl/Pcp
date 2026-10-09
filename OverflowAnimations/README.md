# Overflow Animations V2 — standalone (no OneConfig) build

> **This fork removes OneConfig.** The upstream mod ships OneConfig's `stage0`
> launch-wrapper tweaker, which downloads and starts OneConfig at launch. OneConfig
> renders through NanoVG and its own LWJGL bindings, and that combination crashes under
> PojavLauncher's GL4ES translation layer — so the mod could not be used on Pojav at all.
>
> Everything OneConfig was doing is now done inside the mod:
>
> | Was (OneConfig) | Now |
> | --- | --- |
> | `cc.polyfrost.oneconfig.config.Config` + its annotations | `config.ConfigBase` + `config.annotations.*`, same option names, categories, defaults, dependencies and listeners |
> | OneConfig's NanoVG settings GUI | `gui.OverflowSettingsGui`, drawn with `drawRect` and the vanilla font renderer only |
> | OneConfig profile JSON | `config/overflowanimations.json` (an existing OneConfig profile config is imported automatically on first launch) |
> | `CommandManager` | Forge's `ClientCommandHandler` — `/overflowanimations`, `/oam`, `/oldanimations`, `/animations` as before |
> | `Notifications` | chat messages (`util.Chat`) |
> | `EventManager` / `RenderEvent` | Forge's `TickEvent.ClientTickEvent` |
> | `UMinecraft`, `UResolution`, `utils.dsl.mc` | `Minecraft.getMinecraft()`, `ScaledResolution` |
> | OneConfig's `KotlinLanguageAdapter` | plain Forge language adapter (the mod class is a Kotlin *class*, not an `object`) |
> | Mixin + Kotlin runtime fetched by OneConfig's loader | bundled in the jar; the manifest's `TweakClass` is Mixin's own tweaker |
> | AWT clipboard / Swing dialogs | `GuiScreen.get/setClipboardString` and log output — no `java.awt` or `javax.swing` in the mod's own code |
>
> The animation code itself is untouched: of the 50 mixins and all the hooks, only
> `EntityMixin` and `DebugCrosshairHook` changed, and only to swap a OneConfig utility call
> for the vanilla equivalent. `compat/DulkirConfigMixin` was dropped because it subclassed
> OneConfig's `Config` purely to grey out options in DulkirMod's OneConfig page.
>
> Trade-off worth knowing: OneConfig mods (DulkirMod, DamageTint, Patcher's config) can no
> longer be read, so those integrations are inert unless those mods are installed — and they
> cannot be, without OneConfig. The item-position import/export still works through the
> clipboard.

![Compact Powered by OneConfig](https://polyfrost.org/img/compact_vector.svg)
![Dev Workflow Status](https://img.shields.io/github/v/release/Polyfrost/OverflowAnimationsV2.svg?style=for-the-badge&color=1452cc&label=release)

## [Download (Modrinth)](https://modrinth.com/mod/animations)

This mod combines Overflow Animations (V1) with Sk1er's Old Animations code into a singular mod, with bug fixes, and additional features.

# Features

<details>
  <summary>All features from Sk1er's Old Animations Mod</summary>

* Old Eating
* Old Rod Position
* Old Bow Position
* Old Blockhitting
* Old Swing Animation
* Old Sneak Animation
* Armor turning red when hit
* Old health
* Old blocking
* Old item held
* Punching a block while doing stuff
* 1.7 Debug
* Old Eating Animation

*The "Old Debug Hitbox" feature has been removed as [REDACTION](https://github.com/Polyfrost/REDACTION) has the same functionality.*

</details>

<details>
  <summary>Additional features from 1.7</summary>

* Old 2D/Fast Dropped Items
* Accurate First/Third Person Item Positions
* Old Held Item Lighting 
* Old Projectiles
* Old Item Pickup Animation
* Old Debug and Tab Menu Styles
* Replace cast fishing rod texture with the texture of a stick!
* More features not seen in other old animation mods!

</details>

<details>
  <summary>Modern animations</summary>

* Modern Armor Enchantment Glint
* Show Bow Pullback / Fishing Cast GUI Animation
* Modern Backwards Walk Animation

</details>

<details>
  <summary>Bug Fixes</summary>

* Head Yaw Fixes (Fixes MC-105139)
* Block Breaking Fixes (Fixes MC-255057)

</details>

<details>
  <summary>Quality of Life</summary>

* Disable Hurt Camera Shake
* Allow Particles to No-Clip
* Allow Punching the Ground in Adventure Mode
* Old Lunar/CheatBreaker Block-Hit Position

</details>

## Custom Item Properties
###### Includes Custom Positions for: Swing, Eating/Drinking, Sword Block, Dropped Items, Projectiles, Fireballs, and the Fishing Rod Line.

<details>
  <summary>Customization of Item Postions</summary>

* Custom Item X Position
* Custom Item Y Position
* Custom Item Z Position
* Custom Item Rotation Yaw
* Custom Item Rotation Pitch
* Custom Item Rotation Roll
* Custom Item Scale

</details>


<details>
  <summary>Customization of Item Swing Speed</summary>

* Ignore Mining Fatigue Slowness
* Custom Mining Fatigue Speed
* Ignore Haste Speed
* Custom Haste Speed

</details>

<details>
  <summary>Customization of Item Re-equip Animation</summary>

* Disable Item Re-equip Animation
* Item Re-equip Animation Speed
* Only Play Re-equip Animation Upon Switching Slots

</details>

## Licensing

This mod is currently licensed under version 3 of the GNU Lesser General Public License. 

#### Trademark usage

The GNU LGPL does not grant any license or rights to use Polyfrost or OneConfig trademarks and logos for publicity purposes without written authorization. You may use these trademarks, however, to describe the origin of the mod, or under fair use.

#### Contribution licensing

Contributions to this repository will be automatically licensed under the licensing for the repository at that time (currently version 3 of the LGPL), as defined in Subsection D6 of the GitHub Terms of Service. If you wish to license your contributions to another LGPL-compatible license, please let us know prior.

## Links and support
* Did you run into a bug? [Open a bug report](https://polyfrost.org/discord)
* Have a feature idea? [Join our discord community](https://polyfrost.org/discord)
