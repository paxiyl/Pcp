# Compile-only Forge API stubs

These files exist for one reason: Forge's own jars are not reachable from the build environment
this mod was developed in, so the small part of the Forge API the mod touches is declared here
instead.

They are **never shipped**. `tools/build-jar.sh` compiles against them and then excludes
`net/minecraftforge/**` from the jar, so at runtime the real Forge classes are used. Java links
by name and descriptor, so bytecode compiled against these stubs is identical to bytecode
compiled against Forge itself - provided the signatures match, which is why the surface here is
kept deliberately tiny and limited to parts of the API that have been stable since 1.7.

If you build with `./gradlew build` (the normal ForgeGradle route) these stubs are not used at
all: `build.gradle` excludes this directory and compiles against the real Forge.

Surface used by the mod:

| Type | Members used |
|---|---|
| `Mod`, `Mod.EventHandler` | `modid`, `name`, `version`, `clientSideOnly`, `acceptedMinecraftVersions` |
| `FMLPreInitializationEvent` | `getModConfigurationDirectory()` |
| `FMLInitializationEvent` | (marker) |
| `MinecraftForge.EVENT_BUS` | `register(Object)` |
| `SubscribeEvent` | (marker) |
| `TickEvent` | `phase`, `Phase.END`, `RenderTickEvent.renderTickTime`, `ClientTickEvent` |

Note that `RenderGameOverlayEvent` is deliberately *not* used: the HUD indicator is drawn from
the render-tick hook instead, after the frame has been captured, so the indicator never appears
inside saved clips.
| `ClientRegistry` | `registerKeyBinding(KeyBinding)` |
| `ClientCommandHandler` | `instance`, and `registerCommand` inherited from Minecraft's `CommandHandler` |
