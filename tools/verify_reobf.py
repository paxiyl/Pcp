"""Checks that a built jar is really reobfuscated and really self-contained.

A jar that still refers to Minecraft by its readable development names would install fine and
then fail at runtime with NoSuchMethodError, so this runs as part of every build.
"""
import re, sys, zipfile

jar_path = sys.argv[1]
problems = []
checks = []

with zipfile.ZipFile(jar_path) as jar:
    names = jar.namelist()

    mod_classes = [n for n in names if n.startswith("com/pcpclip/") and n.endswith(".class")]
    jcodec_classes = [n for n in names if n.startswith("org/jcodec/") and n.endswith(".class")]
    forge_classes = [n for n in names if n.startswith("net/minecraftforge/")]
    minecraft_classes = [n for n in names if n.startswith("net/minecraft/")]

    checks.append("mod classes: %d" % len(mod_classes))
    checks.append("bundled JCodec classes: %d" % len(jcodec_classes))

    if not mod_classes:
        problems.append("no mod classes in the jar")
    if not jcodec_classes:
        problems.append("JCodec was not bundled; H.264/MP4 output will be unavailable")
    if forge_classes:
        problems.append("compile-only Forge stubs leaked into the jar: %s" % forge_classes[:3])
    if minecraft_classes:
        problems.append("Minecraft classes leaked into the jar: %s" % minecraft_classes[:3])
    if "mcmod.info" not in names:
        problems.append("mcmod.info is missing; Forge will not list the mod")

    # Readable Minecraft member names that must have become func_/field_ names.
    forbidden = [
        b"getMinecraft", b"displayGuiScreen", b"drawScreen", b"initGui", b"actionPerformed",
        b"getFramebuffer", b"framebufferTexture", b"drawStringWithShadow", b"getStringWidth",
        b"isPressed", b"getScaledWidth", b"setupOverlayRendering", b"drawRect",
    ]
    srg_pattern = re.compile(rb"func_\d+_[a-zA-Z]+")
    srg_hits = 0
    leaked = {}
    for name in mod_classes:
        data = jar.read(name)
        srg_hits += len(srg_pattern.findall(data))
        for token in forbidden:
            # The constant pool holds referenced names; a readable one means the remap missed it.
            if token in data:
                leaked.setdefault(token.decode(), []).append(name)

    checks.append("SRG references found: %d" % srg_hits)
    if srg_hits < 20:
        problems.append("only %d SRG references found; the remap probably did not run" % srg_hits)
    if leaked:
        for token, where in sorted(leaked.items()):
            problems.append("unmapped Minecraft name %r still referenced by %s"
                            % (token, where[0]))

for line in checks:
    print("  " + line)
if problems:
    print()
    for problem in problems:
        print("  PROBLEM: " + problem)
    sys.exit(1)
print("  remap verified")
