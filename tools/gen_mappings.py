"""Build the two mapping files the build needs, from official MCP data.

  obf-to-mcp.srg : applied to Mojang's client jar to get a readable compile classpath
                   (what ForgeGradle calls the "deobfuscated" jar)
  mcp-to-srg.srg : applied to our compiled mod so it links against Forge's runtime
                   SRG names (what ForgeGradle's reobfJar task does)

Inputs are joined.srg (obf -> SRG, with descriptors) plus MCP's fields.csv/methods.csv
(SRG -> readable name).  Class names are identical on the SRG and MCP sides, so only
member names ever change and descriptors can be reused verbatim.
"""
import csv, os, sys

mappings_dir, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)


def read_names(path):
    with open(path, newline="") as fh:
        return {row["searge"]: row["name"] for row in csv.DictReader(fh) if row.get("name")}


fields = read_names(os.path.join(mappings_dir, "names", "fields.csv"))
methods = read_names(os.path.join(mappings_dir, "names", "methods.csv"))

obf_to_mcp, mcp_to_srg = [], []
renamed_fields = renamed_methods = 0

with open(os.path.join(mappings_dir, "srg", "joined.srg")) as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        kind, rest = line.split(": ", 1)
        parts = rest.split()

        if kind in ("PK", "CL"):
            obf_to_mcp.append(line)
            if kind == "CL":
                mcp_to_srg.append("CL: %s %s" % (parts[1], parts[1]))

        elif kind == "FD":
            obf_member, srg_member = parts[0], parts[1]
            owner, srg_name = srg_member.rsplit("/", 1)
            mcp_name = fields.get(srg_name)
            if mcp_name:
                renamed_fields += 1
                obf_to_mcp.append("FD: %s %s/%s" % (obf_member, owner, mcp_name))
                mcp_to_srg.append("FD: %s/%s %s/%s" % (owner, mcp_name, owner, srg_name))
            else:
                obf_to_mcp.append(line)

        elif kind == "MD":
            obf_member, obf_desc, srg_member, srg_desc = parts[0], parts[1], parts[2], parts[3]
            owner, srg_name = srg_member.rsplit("/", 1)
            mcp_name = methods.get(srg_name)
            if mcp_name:
                renamed_methods += 1
                obf_to_mcp.append("MD: %s %s %s/%s %s" % (obf_member, obf_desc, owner, mcp_name, srg_desc))
                mcp_to_srg.append("MD: %s/%s %s %s/%s %s"
                                  % (owner, mcp_name, srg_desc, owner, srg_name, srg_desc))
            else:
                obf_to_mcp.append(line)

        else:
            obf_to_mcp.append(line)

for name, lines in (("obf-to-mcp.srg", obf_to_mcp), ("mcp-to-srg.srg", mcp_to_srg)):
    with open(os.path.join(out_dir, name), "w") as fh:
        fh.write("\n".join(lines) + "\n")
    print("  wrote %s (%d lines)" % (name, len(lines)))
print("  named members: %d fields, %d methods" % (renamed_fields, renamed_methods))
