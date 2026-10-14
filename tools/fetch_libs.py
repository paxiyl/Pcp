"""Download the Minecraft library jars that belong on the 1.8.9 compile classpath."""
import json, os, sys, urllib.request

ver_json, out_dir = sys.argv[1], sys.argv[2]
info = json.load(open(ver_json))

# Natives are irrelevant for compilation; we only need the API jars.
wanted_prefixes = (
    "org.lwjgl.lwjgl:lwjgl:", "org.lwjgl.lwjgl:lwjgl_util:",
    "com.google.guava:guava:", "com.google.code.gson:gson:",
    "org.apache.commons:commons-lang3:", "commons-io:commons-io:",
    "commons-codec:commons-codec:", "com.google.code.findbugs:jsr305:",
    "org.apache.logging.log4j:log4j-api:", "org.apache.logging.log4j:log4j-core:",
    "com.mojang:authlib:", "io.netty:netty-all:", "commons-lang:commons-lang:",
    "net.java.jinput:jinput:", "org.apache.commons:commons-compress:",
    "org.apache.httpcomponents:httpclient:", "org.apache.httpcomponents:httpcore:",
)

count = 0
for lib in info["libraries"]:
    name = lib.get("name", "")
    if not name.startswith(wanted_prefixes):
        continue
    art = lib.get("downloads", {}).get("artifact")
    if not art:
        continue
    dest = os.path.join(out_dir, os.path.basename(art["path"]))
    if os.path.exists(dest) and os.path.getsize(dest) == art.get("size", -1):
        count += 1
        continue
    for attempt in range(5):
        try:
            with urllib.request.urlopen(art["url"], timeout=300) as r:
                data = r.read()
            open(dest, "wb").write(data)
            count += 1
            break
        except Exception as exc:                      # noqa: BLE001 - retry any transport error
            if attempt == 4:
                sys.exit("failed to download %s: %s" % (art["url"], exc))
print("  %d library jars on the compile classpath" % count)
