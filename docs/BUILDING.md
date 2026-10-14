# Building

Two routes. They produce the same jar; pick by whether Forge's maven is reachable from where you
are building.

## Route 1: ForgeGradle (conventional)

Requirements: **Gradle 2.14** and a **Java 8 JDK**. ForgeGradle 2.1 is the only version that
supports Minecraft 1.8.9, and it does not run on newer Gradle or newer Java.

```bash
gradle setupCIWorkspace      # or setupDecompWorkspace if you want Minecraft sources to read
gradle build                 # -> build/libs/pcpclip-1.0.0.jar
gradle coreTest              # the core test suite
gradle benchmark             # the encoder benchmark
```

The build bundles JCodec into the jar (`configurations.bundled`) so there is one file to install.
`stubs/java` is **not** on the source path here - the real Forge classes are.

## Route 2: without ForgeGradle

This route needs only Mojang's published client jar, the published MCP mappings, and
SpecialSource - the same remapper ForgeGradle itself uses. It exists because Forge's maven was
not reachable from the environment this mod was developed in (every path under
`maven.minecraftforge.net/net/minecraftforge/forge/**` returned 404 from there, for 1.8.9 and for
other versions alike), and it is the route that was actually used and verified for the released
jar.

```bash
tools/bootstrap-devenv.sh    # once
tools/build-jar.sh           # -> dist/pcpclip-1.0.0-1.8.9.jar
tools/run-tests.sh
```

`tools/bootstrap-devenv.sh` fetches into a git-ignored `.devenv/`:

| What | From | Why |
|---|---|---|
| Temurin JDK 8 | api.adoptium.net | compile to Java 8, and run the tests on the major version Pojav ships |
| Minecraft 1.8.9 client jar | Mojang's CDN, via the official version manifest | the compile classpath |
| `mcp-1.8.9-srg.zip` | Forge maven | obfuscated -> SRG mappings |
| `mcp_stable-22-1.8.9.zip` | Forge maven | SRG -> readable names |
| SpecialSource 1.11 | Maven Central | the remapper |
| JCodec 0.2.5 | Maven Central | bundled H.264 encoder |
| Minecraft's library jars | Mojang's CDN | LWJGL, Guava and friends for the compile classpath |

Nothing fetched is redistributed; `.devenv/` is git-ignored and the Minecraft jar never leaves it.

### How the remap works

`tools/gen_mappings.py` builds two mapping files from the official MCP data. Class names are
identical on the SRG and MCP sides, so only member names ever change and descriptors can be
reused verbatim:

* `obf-to-mcp.srg` - applied to Mojang's client jar to produce a readable compile classpath
  (ForgeGradle calls this the deobfuscated jar);
* `mcp-to-srg.srg` - applied to the compiled mod so it links against the SRG names Forge's
  deobfuscating transformer installs at runtime (ForgeGradle's `reobfJar`).

SpecialSource runs with `--live` and the Minecraft jar, the compiled mod **and the compiled stubs**
on its classpath, so inheritance resolves and **overriding** methods are renamed too, not just
call sites - `drawScreen` becomes `func_73863_a` in `GuiPcpBase` as well as at every call site.

The stubs matter for more than compiling: without them on the remapper's classpath, a method
declared on a Minecraft class but called through a Forge subclass (`ClientCommandHandler`
inheriting `CommandHandler.registerCommand`) keeps its readable name and the mod dies at init
with `NoSuchMethodError`. `tools/verify_links.py` fails the build if that happens.

### The Forge API stubs

Forge's own jars are unavailable on this route, so `stubs/java` declares the small part of the
Forge API the mod uses - the `@Mod` annotation, two lifecycle events, the event bus,
`SubscribeEvent`, `TickEvent` and `ClientRegistry`. They are compile-only: the build excludes
`net/minecraftforge/**` from the jar and the verifier fails the build if any leaks in. Java links
by name and descriptor, so bytecode compiled against an accurate stub is identical to bytecode
compiled against Forge. See `stubs/java/README.md` for the exact surface.

### Build verification

Every build ends with two checks, and fails if either does:

```
[5/6] verifying the remap
  mod classes: 85
  bundled JCodec classes: 901
  SRG references found: 94
  remap verified
[6/6] verifying every Minecraft reference resolves at runtime
  verifier self-tests passed
  distinct Minecraft references checked: 69
  Minecraft classes touched: 16
  every Minecraft reference resolves against a real SRG-named 1.8.9 client
```

See [TESTING.md](TESTING.md) for what those two verifiers actually assert.

## Building without JCodec

MP4 output is optional. Removing `org/jcodec/**` from the jar leaves Motion JPEG working and the
encoder probe reports H.264 as unavailable with the reason. Nothing crashes - the dependency is
guarded at the point of use.
