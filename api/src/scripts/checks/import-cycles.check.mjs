/*
  Import cycles among the API's own modules.

  `user.model` imported PAYMENT_METHODS from `order.model`, which imports
  `notification.service`, which imports `user.model` — a cycle Node resolves by
  handing out a binding that is not initialised yet. Loading one model first
  worked; loading the other threw "Cannot access 'PAYMENT_METHODS' before
  initialization". The API booted at all only because of the order index.ts
  happened to use.

  TypeScript compiles cycles happily, so this walks the graph instead.
*/
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const SRC = fileURLToPath(new URL("../../", import.meta.url));

const files = globSync("**/*.ts", { cwd: SRC })
  .filter((f) => !f.startsWith("scripts/checks/"))
  .map((f) => path.join(SRC, f));

/**
 * Relative VALUE imports only.
 *
 * Two exclusions, both load-bearing. A cycle through node_modules is not ours
 * to fix. And `import type` is erased by the compiler, so a type-only cycle
 * cannot exist at runtime — counting it would mean reporting
 * notification.service ⇄ order.model, which is type-only and harmless, and a
 * checker that cries wolf once gets ignored forever.
 */
const importsOf = (file) => {
  const source = readFileSync(file, "utf8");

  const specifiers = [...source.matchAll(/^\s*import\s+([^;]*?)\s*from\s+["'](\.[^"']+)["']/gm)]
    .filter(([, clause]) => {
      // `import type { X } from …` — erased wholesale.
      if (/^type\s/.test(clause.trim())) return false;

      // `import { type A, type B } from …` — erased too, when every one is a type.
      const named = clause.match(/\{([^}]*)\}/);

      if (named && !/^\s*\{/.test(clause.trim().replace(/^\w+\s*,\s*/, ""))) {
        // A default or namespace import sits alongside the braces; it is a value.
        return true;
      }

      if (named) {
        const parts = named[1]
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);

        return parts.length > 0 && !parts.every((part) => part.startsWith("type "));
      }

      return true;
    })
    .map(([, , specifier]) => specifier);

  return specifiers
    .map((specifier) => {
      const resolved = path.resolve(path.dirname(file), specifier);

      for (const candidate of [`${resolved}.ts`, path.join(resolved, "index.ts")]) {
        if (files.includes(candidate)) return candidate;
      }

      return null;
    })
    .filter(Boolean);
};

const graph = new Map(files.map((file) => [file, importsOf(file)]));

const cycles = [];
const state = new Map();

/** Depth-first, tracking the path so a cycle can be named rather than counted. */
const walk = (file, trail) => {
  if (state.get(file) === "done") return;

  if (state.get(file) === "visiting") {
    const start = trail.indexOf(file);

    cycles.push([...trail.slice(start), file]);

    return;
  }

  state.set(file, "visiting");

  for (const next of graph.get(file) ?? []) walk(next, [...trail, file]);

  state.set(file, "done");
};

for (const file of files) walk(file, []);

const show = (file) => path.relative(SRC, file);

// The same cycle can be reached from several entry points; report each once.
const unique = new Map();

for (const cycle of cycles) {
  const key = [...cycle.map(show)].sort().join("|");

  if (!unique.has(key)) unique.set(key, cycle);
}

/*
  The graph can look clean and the app still crash, so this is the property
  that actually matters: every model has to survive being the FIRST thing
  loaded. That is what differed between a working boot and
  "Cannot access 'PAYMENT_METHODS' before initialization" — index.ts simply
  happened to import them in an order that worked.

  Each model is loaded in its own child process, because once a module is in
  this process's cache the order no longer matters.
*/
const loadOrderIsSafe = async () => {
  const { readdirSync } = await import("node:fs");
  const { spawn } = await import("node:child_process");

  const modelsDir = path.join(SRC, "models");
  const models = readdirSync(modelsDir).filter((f) => f.endsWith(".ts"));

  const env = {
    ...process.env,
    JWT_SECRET: "check-only-secret-long-enough-to-pass",
    MONGODB_URI: "mongodb://127.0.0.1:27017/import-order-check",
  };

  let broken = 0;

  for (const model of models) {
    const target = path.join(modelsDir, model);

    const failure = await new Promise((resolve) => {
      const child = spawn("npx", ["tsx", "-e", `import(${JSON.stringify(target)})`], {
        env,
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";

      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("exit", (code) => resolve(code === 0 ? null : stderr));
    });

    if (failure) {
      broken += 1;
      const line = failure.split("\n").find((l) => /Error|error/.test(l)) ?? failure.slice(0, 200);

      console.log(`FAIL  ${model} cannot be loaded first → ${line.trim()}`);
    } else {
      console.log(`PASS  ${model} loads first cleanly`);
    }
  }

  return broken === 0;
};

if (unique.size === 0) {
  console.log(`No value-import cycles among ${files.length} modules.\n`);

  const safe = await loadOrderIsSafe();

  console.log(
    safe
      ? "\nEvery model survives being loaded first."
      : "\nAt least one model depends on load order.",
  );

  process.exit(safe ? 0 : 1);
}

console.log(`${unique.size} import cycle(s) found:\n`);

for (const cycle of unique.values()) {
  console.log(`  ${cycle.map(show).join("\n    → ")}\n`);
}

process.exit(1);
