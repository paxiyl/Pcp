#!/usr/bin/env bash
# Bootstraps an offline-capable Minecraft 1.8.9 development classpath without ForgeGradle.
#
# What it does:
#   1. downloads a JDK 8 (used to RUN the core test-suite on the same major version Pojav ships)
#   2. downloads the Minecraft 1.8.9 client jar from Mojang's CDN
#   3. downloads MCP 1.8.9 SRG mappings + MCP "stable_22" names from the Forge maven
#   4. downloads SpecialSource (the remapper ForgeGradle itself uses)
#   5. downloads the Minecraft runtime libraries needed on the compile classpath (LWJGL, guava, ...)
#   6. generates obf->MCP and MCP->SRG mappings and produces a deobfuscated compile jar
#
# Everything lands in .devenv/ which is git-ignored. Nothing here is redistributed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV="$ROOT/.devenv"
MC_VERSION="1.8.9"
MCP_CHANNEL="stable"
MCP_VERSION="22-1.8.9"
SPECIALSOURCE_VERSION="1.11.0"
JCODEC_VERSION="0.2.5"

FORGE_MAVEN="https://maven.minecraftforge.net"
CENTRAL="https://repo1.maven.org/maven2"

mkdir -p "$DEV"/{jdk8,mc,mappings,tools,libs,out}

dl() { # dl <url> <dest>
  local url="$1" dest="$2" tries=0
  [ -s "$dest" ] && { echo "  cached  $(basename "$dest")"; return 0; }
  until [ $tries -ge 5 ]; do
    if curl -fsSL --max-time 600 -o "$dest.part" "$url"; then
      mv "$dest.part" "$dest"; echo "  got     $(basename "$dest") ($(du -h "$dest" | cut -f1))"; return 0
    fi
    tries=$((tries+1)); echo "  retry $tries  $url"; sleep $((2 ** tries))
  done
  echo "FAILED: $url" >&2; return 1
}

echo "[1/6] JDK 8 (for running the core tests on a Pojav-like JRE)"
if [ ! -x "$DEV/jdk8/bin/java" ]; then
  dl "https://api.adoptium.net/v3/binary/latest/8/ga/linux/x64/jdk/hotspot/normal/eclipse" "$DEV/tools/jdk8.tar.gz"
  tar -xzf "$DEV/tools/jdk8.tar.gz" -C "$DEV/jdk8" --strip-components=1
fi
"$DEV/jdk8/bin/java" -version 2>&1 | head -1

echo "[2/6] Minecraft $MC_VERSION client jar"
dl "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json" "$DEV/mc/version_manifest_v2.json"
python3 "$ROOT/tools/pick_version.py" "$DEV/mc/version_manifest_v2.json" "$MC_VERSION" "$DEV/mc"
dl "$(cat "$DEV/mc/client-url.txt")" "$DEV/mc/client-obf.jar"

echo "[3/6] MCP mappings"
dl "$FORGE_MAVEN/de/oceanlabs/mcp/mcp/$MC_VERSION/mcp-$MC_VERSION-srg.zip" "$DEV/mappings/mcp-srg.zip"
dl "$FORGE_MAVEN/de/oceanlabs/mcp/mcp_${MCP_CHANNEL}/$MCP_VERSION/mcp_${MCP_CHANNEL}-$MCP_VERSION.zip" "$DEV/mappings/mcp-names.zip"
rm -rf "$DEV/mappings/srg" "$DEV/mappings/names"
mkdir -p "$DEV/mappings/srg" "$DEV/mappings/names"
unzip -qo "$DEV/mappings/mcp-srg.zip" -d "$DEV/mappings/srg"
unzip -qo "$DEV/mappings/mcp-names.zip" -d "$DEV/mappings/names"

echo "[4/6] SpecialSource remapper + optional jcodec"
dl "$CENTRAL/net/md-5/SpecialSource/$SPECIALSOURCE_VERSION/SpecialSource-$SPECIALSOURCE_VERSION-shaded.jar" "$DEV/tools/specialsource.jar"
dl "$CENTRAL/org/jcodec/jcodec/$JCODEC_VERSION/jcodec-$JCODEC_VERSION.jar" "$DEV/libs/jcodec-$JCODEC_VERSION.jar"

echo "[5/6] Minecraft runtime libraries (compile classpath)"
python3 "$ROOT/tools/fetch_libs.py" "$DEV/mc/$MC_VERSION.json" "$DEV/libs"

echo "[6/6] Generating mappings and the deobfuscated compile jar"
python3 "$ROOT/tools/gen_mappings.py" "$DEV/mappings" "$DEV/out"
if [ ! -s "$DEV/out/minecraft-$MC_VERSION-mcp.jar" ]; then
  "$DEV/jdk8/bin/java" -jar "$DEV/tools/specialsource.jar" \
      --in-jar "$DEV/mc/client-obf.jar" \
      --srg-in "$DEV/out/obf-to-mcp.srg" \
      --out-jar "$DEV/out/minecraft-$MC_VERSION-mcp.jar" \
      --quiet
fi
echo
echo "devenv ready:"
echo "  compile jar : $DEV/out/minecraft-$MC_VERSION-mcp.jar"
echo "  reobf map   : $DEV/out/mcp-to-srg.srg"
echo "  jdk8        : $DEV/jdk8/bin/java"
