/*
  Every path the two clients call must be a route the API actually serves.

  Nothing in either language checks this. `API.get("/banners")` typechecks
  perfectly, returns the declared type, and 404s forever — the real path is
  `/banners/active`. The two halves live in different codebases and agree only
  because somebody was careful, which is the same reason the search response
  shape drifted and `isVeg` was never persisted.

  So: the server's route table is read off the real Express routers, the
  clients' call sites off their one API module each, and the two are compared.
  It also reports a route file that is never mounted (dead code, or a mount
  somebody forgot) and routes no client calls (fine on its own — admin-only
  endpoints exist — but worth seeing in a list).
*/
import { readdirSync, readFileSync } from "node:fs";

// Importing a route module pulls in its controllers, services and models, and
// `env.config.ts` refuses to load without these. Nothing here connects.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/route-coverage-check";
process.env.JWT_SECRET ??= "check-only-secret-long-enough-to-pass";
process.env.LOG_LEVEL ??= "error";

const api = new URL("../..", import.meta.url).pathname;
const repo = new URL("../../../../", import.meta.url).pathname;

const checks = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
};

/* ── The server's route table, from the real routers ───────────────────── */

const routeDir = `${api}/routes/v1`;
const files = readdirSync(routeDir).filter((name) => name.endsWith(".route.ts"));

/** An Express router is a function carrying a layer stack. */
const isRouter = (value) =>
  typeof value === "function" && Array.isArray(value.stack);

const routers = new Map();

for (const file of files) {
  const module = await import(`${routeDir}/${file}`);

  for (const [name, value] of Object.entries(module)) {
    if (isRouter(value)) routers.set(name, { file, router: value });
  }
}

/*
  The mount prefixes. Express 5 keeps a mounted router's prefix in compiled
  matcher functions rather than on `layer.path`, so walking the parent stack
  cannot recover it — the prefixes are read from the one file that declares
  them instead. The leaf paths still come from the router objects.
*/
const index = readFileSync(`${routeDir}/index.ts`, "utf8");
const mounts = [...index.matchAll(/routes\.use\("([^"]+)",\s*(\w+)\)/g)].map(
  ([, prefix, name]) => ({ name, prefix }),
);

/** `/orders/:id/cancel` and `/orders/${id}/cancel` have to compare equal. */
const normalise = (path) =>
  path
    .replace(/\?.*$/, "")
    .replace(/\$\{[^}]*\}/g, "*")
    .replace(/:[^/]+/g, "*")
    .replace(/\/+$/, "") || "/";

const served = new Set();
const servedList = [];

for (const { name, prefix } of mounts) {
  const entry = routers.get(name);

  if (!entry) continue;

  for (const layer of entry.router.stack) {
    if (!layer.route) continue;

    for (const method of Object.keys(layer.route.methods)) {
      const path = normalise(`${prefix}${layer.route.path}`);
      served.add(`${method.toUpperCase()} ${path}`);
      servedList.push(`${method.toUpperCase()} ${path}`);
    }
  }
}

console.log(`\nThe API serves ${served.size} routes under /api/v1, from ${mounts.length} mounts.`);
check("every mount resolves to a router", mounts.filter(({ name }) => !routers.has(name)).map(({ name }) => name), []);
check("the route table is not empty", served.size > 0, true);

/* A route file nobody mounts is dead code, or a mount somebody forgot. */
const mounted = new Set(mounts.map(({ name }) => name));
const unmounted = [...routers.entries()]
  .filter(([name]) => !mounted.has(name))
  .map(([name, { file }]) => `${name} (${file})`);

check("every exported router is mounted", unmounted, []);

/* ── What the clients ask for ──────────────────────────────────────────── */

const clients = [
  { file: `${repo}mobile/src/lib/api.ts`, name: "mobile" },
  { file: `${repo}admin/src/lib/api.ts`, name: "admin" },
];

const CALL = /\bAPI\.(get|post|patch|put|delete)\(\s*[`"']([^`"']*)[`"']/g;

for (const client of clients) {
  const source = readFileSync(client.file, "utf8");
  const calls = [...source.matchAll(CALL)].map(([, method, path]) => ({
    method: method.toUpperCase(),
    path: normalise(path),
    raw: path,
  }));

  const missing = calls
    .filter(({ method, path }) => !served.has(`${method} ${path}`))
    .map(({ method, raw }) => `${method} ${raw}`);

  console.log(`\n${client.name} calls ${calls.length} endpoints`);
  check(`every path the ${client.name} app calls is served`, [...new Set(missing)], []);
  check(`the ${client.name} app's calls were found at all`, calls.length > 0, true);

  client.calls = calls;
}

/*
  Routes no client calls. Not a failure — the admin app does not use every
  owner endpoint and vice versa — but an endpoint nobody calls is either
  unfinished work or something to delete, and neither should be invisible.
*/
const called = new Set(
  clients.flatMap(({ calls }) => calls.map(({ method, path }) => `${method} ${path}`)),
);
const uncalled = [...served].filter((route) => !called.has(route)).sort();

console.log(`\n${uncalled.length} of ${served.size} routes are called by neither client:`);
for (const route of uncalled) console.log(`  ${route}`);

/* Duplicate registrations: two handlers on one method and path, one dead. */
const duplicates = servedList.filter((route, position) => servedList.indexOf(route) !== position);
check("no route is registered twice", [...new Set(duplicates)], []);

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
