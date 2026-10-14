#!/usr/bin/env bash
# Compiles and runs the core test suite and, with "bench", the encoder benchmark.
#
# The suite runs on the JDK 8 fetched by tools/bootstrap-devenv.sh, which is the same major
# version PojavLauncher's default runtime uses. It needs no Minecraft: everything it exercises -
# geometry, config, the rolling buffer, the encoders, the muxers, the whole engine - is
# deliberately free of Minecraft types. ffprobe is used, when present, to verify the clips
# independently of our own code.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV="$ROOT/.devenv"
export JAVA_TOOL_OPTIONS=

JAVA="$DEV/jdk8/bin/java"
JAVAC="$DEV/jdk8/bin/javac"
JCODEC="$DEV/libs/jcodec-0.2.5.jar"
for required in "$JAVAC" "$JCODEC"; do
  [ -e "$required" ] || { echo "missing $required - run tools/bootstrap-devenv.sh first" >&2; exit 1; }
done

CORE="$DEV/classes/core"
TESTS="$DEV/classes/test"
rm -rf "$CORE" "$TESTS"
mkdir -p "$CORE" "$TESTS"

echo "compiling the Minecraft-independent core"
find "$ROOT/src/main/java/com/pcpclip/core" -name '*.java' > "$DEV/core-sources.txt"
"$JAVAC" -Xlint:all -encoding UTF-8 -cp "$JCODEC" -d "$CORE" @"$DEV/core-sources.txt"

echo "compiling the tests"
find "$ROOT/src/test/java" -name '*.java' > "$DEV/test-sources.txt"
"$JAVAC" -Xlint:all -encoding UTF-8 -cp "$CORE:$JCODEC" -d "$TESTS" @"$DEV/test-sources.txt"

if [ "${1:-}" = "bench" ]; then
  echo
  "$JAVA" -Xmx1g -cp "$CORE:$TESTS:$JCODEC" com.pcpclip.test.BenchmarkMain
else
  echo
  "$JAVA" -Xmx768m -cp "$CORE:$TESTS:$JCODEC" com.pcpclip.test.TestMain
fi
