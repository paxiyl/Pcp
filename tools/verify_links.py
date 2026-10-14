"""Checks that every Minecraft reference in the built jar resolves at runtime.

Minecraft cannot be launched in a build environment, so this is the next best thing: take the
finished jar, read every member reference it makes to a {@code net.minecraft} class, and look
each one up in a real SRG-named Minecraft 1.8.9 - walking superclasses and interfaces the way the
JVM does. A wrong name or a wrong descriptor would show up here as the NoSuchMethodError it would
have become in game.

Forge's own classes cannot be checked this way (Forge's jars are not available in this
environment); those references are covered by the small, stable surface in stubs/java.
"""
import re, subprocess, sys, zipfile
from collections import defaultdict

jar_path, srg_jar, javap = sys.argv[1], sys.argv[2], sys.argv[3]

REFERENCE = re.compile(r"//\s+(Method|Field|InterfaceMethod)\s+([\w/$]+)\.([\w$<>]+):(\S+)")
DECLARED = re.compile(r"^\s{2}(?:[\w\s]*?)([\w$<>.\[\]]+)\s*(\([^)]*\))?;?\s*$")

_class_cache = {}


def describe_class(name):
    """Returns (members, supertypes) for a class in the SRG jar, via javap -p -s."""
    if name in _class_cache:
        return _class_cache[name]
    result = subprocess.run(
        [javap, "-p", "-s", "-cp", srg_jar, name.replace("/", ".")],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        _class_cache[name] = (None, [])
        return _class_cache[name]

    members = set()
    supertypes = []
    lines = result.stdout.splitlines()
    pending_name = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("public class", "class", "public final class", "final class",
                                "public abstract class", "abstract class", "public interface",
                                "interface", "public enum", "enum")):
            # "public class a extends b implements c, d {"
            if " extends " in stripped:
                after = stripped.split(" extends ", 1)[1]
                parent = after.split(" implements ")[0].split("<")[0].strip().rstrip("{").strip()
                if parent:
                    supertypes.append(parent.replace(".", "/"))
            if " implements " in stripped:
                after = stripped.split(" implements ", 1)[1].rstrip("{").strip()
                for interface in after.split(","):
                    interface = interface.split("<")[0].strip()
                    if interface:
                        supertypes.append(interface.replace(".", "/"))
            continue
        if stripped.startswith("descriptor:"):
            descriptor = stripped.split("descriptor:", 1)[1].strip()
            if pending_name:
                members.add((pending_name, descriptor))
                pending_name = None
            continue
        # A declaration line; remember the simple name for the descriptor line that follows.
        match = re.search(r"([\w$<>]+)\s*\(", stripped)
        if match:
            pending_name = match.group(1)
        else:
            match = re.search(r"([\w$]+);$", stripped)
            pending_name = match.group(1) if match else None

    _class_cache[name] = (members, supertypes)
    return _class_cache[name]


def resolves(owner, member, descriptor, seen=None):
    """JVM-style lookup: the class itself, then its superclasses and interfaces."""
    if seen is None:
        seen = set()
    if owner in seen:
        return False
    seen.add(owner)
    members, supertypes = describe_class(owner)
    if members is None:
        return False
    if (member, descriptor) in members:
        return True
    for parent in supertypes:
        if parent.startswith("java/") or parent.startswith("com/google/"):
            continue
        if resolves(parent, member, descriptor, seen):
            return True
    return False


# Self-tests, so a verifier that silently stopped working cannot report success.
if not resolves("net/minecraft/client/Minecraft", "func_71410_x",
                "()Lnet/minecraft/client/Minecraft;"):
    sys.exit("verifier self-test failed: a known member did not resolve")
if not resolves("net/minecraft/client/gui/GuiScreen", "func_73734_a", "(IIIII)V"):
    sys.exit("verifier self-test failed: inherited lookup is not working")
if resolves("net/minecraft/client/Minecraft", "func_00000_notreal", "()V"):
    sys.exit("verifier self-test failed: a fabricated member appeared to resolve")
if resolves("net/minecraft/client/Minecraft", "func_71410_x", "(IJ)V"):
    sys.exit("verifier self-test failed: a wrong descriptor appeared to resolve")
print("  verifier self-tests passed")

with zipfile.ZipFile(jar_path) as jar:
    mod_classes = [n for n in jar.namelist()
                   if n.startswith("com/pcpclip/") and n.endswith(".class")]

references = defaultdict(set)
batch = [name[:-6].replace("/", ".") for name in mod_classes]
disassembly = subprocess.run(
    [javap, "-p", "-c", "-cp", jar_path] + batch,
    capture_output=True, text=True,
)
if disassembly.returncode != 0:
    sys.exit("javap failed on the built jar:\n" + disassembly.stderr[:2000])

current = "?"
for line in disassembly.stdout.splitlines():
    if line and not line.startswith(" ") and "class " in line:
        current = line.strip()
    match = REFERENCE.search(line)
    if match:
        kind, owner, member, descriptor = match.groups()
        if owner.startswith("net/minecraft/"):
            references[(owner, member, descriptor)].add(current)

checked = 0
missing = []
for (owner, member, descriptor), used_by in sorted(references.items()):
    checked += 1
    if member == "<init>":
        # Constructors are not renamed, but the descriptor still has to exist.
        if not resolves(owner, "<init>", descriptor):
            missing.append((owner, member, descriptor, used_by))
        continue
    if not resolves(owner, member, descriptor):
        missing.append((owner, member, descriptor, used_by))

print("  distinct Minecraft references checked: %d" % checked)
print("  Minecraft classes touched: %d" % len({owner for owner, _, _ in references}))
if missing:
    print()
    for owner, member, descriptor, used_by in missing:
        print("  UNRESOLVED %s.%s%s" % (owner, member, descriptor))
        for user in sorted(used_by):
            print("      used by %s" % user)
    sys.exit(1)
print("  every Minecraft reference resolves against a real SRG-named 1.8.9 client")
