"""Resolve a Minecraft version manifest entry and write the client-jar URL."""
import json, sys, urllib.request, os

manifest_path, version, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
manifest = json.load(open(manifest_path))
try:
    entry = next(v for v in manifest["versions"] if v["id"] == version)
except StopIteration:
    sys.exit("version %s not in manifest" % version)

ver_json = os.path.join(out_dir, version + ".json")
if not os.path.exists(ver_json) or os.path.getsize(ver_json) == 0:
    with urllib.request.urlopen(entry["url"], timeout=120) as r:
        data = r.read()
    open(ver_json, "wb").write(data)

info = json.load(open(ver_json))
client = info["downloads"]["client"]
open(os.path.join(out_dir, "client-url.txt"), "w").write(client["url"])
print("  version json: %s (client %.1f MiB)" % (ver_json, client["size"] / 1048576.0))
