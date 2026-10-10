/*
  Every model's TypeScript interface, checked against the paths Mongoose
  actually registered.

  This exists because `isVeg` was declared on DishDocument and required by the
  Zod validator, but had no path in the schema — so Mongoose's strict mode
  dropped it on every single write, silently, for the whole life of the feature.
  The admin form made you choose Veg or Non-veg and then threw the answer away.

  Nothing in a typecheck can catch that: the interface and the schema are two
  separate declarations that only have to agree by hand. So this compares them
  by hand, mechanically, for every model at once.
*/
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Some models reach config through the env, which refuses to load without
// these. Nothing here connects to anything; the schemas are read in memory.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/schema-drift-check";
process.env.JWT_SECRET ??= "check-only-secret-long-enough-to-pass";

const MODELS_DIR = new URL("../../models/", import.meta.url).pathname;

/**
 * Fields that are legitimately on the interface without being schema paths.
 * Each needs a reason, so an unexplained absence stays visible.
 */
const EXEMPT = {
  // Mongoose provides these itself.
  all: ["_id", "createdAt", "updatedAt", "__v"],
  // Declared methods, not data.
  "user.model.ts": ["comparePassword"],
};

const mongoose = (await import("mongoose")).default;

// Importing a model registers its schema. Order does not matter here.
const files = readdirSync(MODELS_DIR).filter((f) => f.endsWith(".model.ts"));

for (const file of files) {
  await import(path.join(MODELS_DIR, file));
}

/** Pulls the field names out of `export interface XDocument extends Document {…}`. */
const interfaceFields = (source) => {
  const match = source.match(/export interface \w+Document extends Document \{([\s\S]*?)\n\}/);

  if (!match) return null;

  const body = match[1]
    // Strip block comments, so a field name mentioned in prose is not counted.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  return [...body.matchAll(/^\s{2}(\w+)\??\s*:/gm)].map((m) => m[1]);
};

let problems = 0;

for (const file of files) {
  const source = readFileSync(path.join(MODELS_DIR, file), "utf8");
  const fields = interfaceFields(source);

  if (!fields) continue;

  // Find the registered model whose schema this file defined.
  const modelName = Object.keys(mongoose.models).find((name) => {
    const expected = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

    return file === `${expected}.model.ts`;
  });

  if (!modelName) {
    console.log(`SKIP  ${file}: could not match a registered model`);
    continue;
  }

  const paths = Object.keys(mongoose.models[modelName].schema.paths);
  const exempt = new Set([...EXEMPT.all, ...(EXEMPT[file] ?? [])]);

  /*
    A nested object registers as its leaves, not itself: `location` on a
    Restaurant appears as `location.type` and `location.coordinates`, and
    `deliveryAddress` on an Order as `deliveryAddress.line1` and so on. So a
    field counts as persisted if it is a path OR the prefix of one — otherwise
    the check reports four confident false positives and nobody trusts it
    again.
  */
  const persisted = (field) =>
    paths.includes(field) || paths.some((p) => p.startsWith(`${field}.`));

  const missing = fields.filter((field) => !persisted(field) && !exempt.has(field));

  if (missing.length > 0) {
    problems += missing.length;
    console.log(`FAIL  ${modelName} (${file}): declared but NOT persisted → ${missing.join(", ")}`);
  } else {
    console.log(`PASS  ${modelName}: ${fields.length} fields all persisted`);
  }
}

console.log(
  problems === 0
    ? "\nNo schema drift: every declared field has a Mongoose path."
    : `\n${problems} field(s) would be silently dropped on write.`,
);

process.exit(problems === 0 ? 0 : 1);
