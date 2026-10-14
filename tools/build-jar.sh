#!/usr/bin/env bash
# Builds the installable mod jar without ForgeGradle.
#
# Steps, which mirror what ForgeGradle's build + reobfJar do:
#   1. compile the compile-only Forge API stubs (stubs/java, never shipped)
#   2. compile the mod against the deobfuscated Minecraft jar
#   3. stage classes, resources and the bundled JCodec
#   4. remap MCP member names to the SRG names Forge uses at runtime (SpecialSource)
#
# Run tools/bootstrap-devenv.sh first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV="$ROOT/.devenv"
MC_VERSION="1.8.9"
MOD_VERSION="1.0.0"
JCODEC_JAR="$DEV/libs/jcodec-0.2.5.jar"

JAVA="$DEV/jdk8/bin/java"
JAVAC="$DEV/jdk8/bin/javac"
JAR="$DEV/jdk8/bin/jar"
MC_JAR="$DEV/out/minecraft-$MC_VERSION-mcp.jar"
REOBF_SRG="$DEV/out/mcp-to-srg.srg"

for required in "$JAVAC" "$MC_JAR" "$REOBF_SRG" "$JCODEC_JAR" "$DEV/tools/specialsource.jar"; do
  [ -e "$required" ] || { echo "missing $required - run tools/bootstrap-devenv.sh first" >&2; exit 1; }
done

export JAVA_TOOL_OPTIONS=
BUILD="$DEV/build"
rm -rf "$BUILD"
mkdir -p "$BUILD"/{stubs,classes,stage}
mkdir -p "$ROOT/dist"

LIBS=$(find "$DEV/libs" -name '*.jar' | tr '\n' ':')
CP_COMPILE="$MC_JAR:$LIBS$BUILD/stubs"

echo "[1/6] compiling Forge API stubs (compile-only, not shipped)"
find "$ROOT/stubs/java" -name '*.java' > "$BUILD/stub-sources.txt"
"$JAVAC" -nowarn -cp "$MC_JAR:$LIBS" -d "$BUILD/stubs" @"$BUILD/stub-sources.txt"

echo "[2/6] compiling the mod (Java 8 bytecode)"
find "$ROOT/src/main/java" -name '*.java' > "$BUILD/sources.txt"
"$JAVAC" -Xlint:all -encoding UTF-8 -source 8 -target 8 \
    -cp "$CP_COMPILE" -d "$BUILD/classes" @"$BUILD/sources.txt"

echo "[3/6] staging classes, resources and JCodec"
cp -r "$BUILD/classes/." "$BUILD/stage/"
cp -r "$ROOT/src/main/resources/." "$BUILD/stage/"
# JCodec is pure Java and ships inside the mod so there is one file to install on a phone.
( cd "$BUILD/stage" && "$JAR" xf "$JCODEC_JAR" )
rm -rf "$BUILD/stage/META-INF"
cp "$ROOT/NOTICE.txt" "$BUILD/stage/" 2>/dev/null || true
# The stubs stand in for Forge at compile time only; Forge provides the real classes at runtime.
rm -rf "$BUILD/stage/net/minecraftforge"

DEV_JAR="$ROOT/dist/pcpclip-$MOD_VERSION-$MC_VERSION-dev.jar"
FINAL_JAR="$ROOT/dist/pcpclip-$MOD_VERSION-$MC_VERSION.jar"
( cd "$BUILD/stage" && "$JAR" cf "$DEV_JAR" . )

echo "[4/6] remapping MCP names to Forge's runtime SRG names"
# The stub classes go on the classpath as well: SpecialSource needs to see that a Forge type
# extends a Minecraft one before it can remap an inherited member referenced through it.
"$JAVA" -cp "$DEV/tools/specialsource.jar:$MC_JAR:$LIBS$BUILD/classes:$BUILD/stubs" \
    net.md_5.specialsource.SpecialSource \
    --in-jar "$DEV_JAR" \
    --out-jar "$FINAL_JAR" \
    --srg-in "$REOBF_SRG" \
    --live \
    --quiet

echo "[5/6] verifying the remap"
python3 "$ROOT/tools/verify_reobf.py" "$FINAL_JAR"

echo "[6/6] verifying every Minecraft reference resolves at runtime"
SRG_JAR="$DEV/out/minecraft-$MC_VERSION-srg.jar"
if [ ! -s "$SRG_JAR" ]; then
  cp "$DEV/mappings/srg/joined.srg" "$DEV/out/obf-to-srg.srg"
  "$JAVA" -jar "$DEV/tools/specialsource.jar" \
      --in-jar "$DEV/mc/client-obf.jar" \
      --srg-in "$DEV/out/obf-to-srg.srg" \
      --out-jar "$SRG_JAR" --quiet
fi
python3 "$ROOT/tools/verify_links.py" "$FINAL_JAR" "$SRG_JAR" "$DEV/jdk8/bin/javap" "$REOBF_SRG"

echo
echo "built:"
ls -lh "$FINAL_JAR" "$DEV_JAR" | awk '{print "  " $9 "  " $5}'
