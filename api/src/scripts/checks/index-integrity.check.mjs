/*
  Every index a model declares must actually exist, with the options it declared.

  Mongoose deduplicates indexes by key pattern and keeps the FIRST definition,
  silently discarding the second one's options. So this:

      userId: { type: ObjectId, index: true }
      schema.index({ userId: 1 }, { unique: true, partialFilterExpression: … })

  creates a plain, non-unique index and drops the uniqueness on the floor. It
  warns at boot, in a line that scrolls past among the startup logs, and
  everything keeps working until two records the database was supposed to refuse
  both land. On `PartnerApplication` that was the rule stopping one account from
  filing two open applications at once.

  Same family as `schema-drift.check.mjs`: something declared, typechecking
  perfectly, and never reaching the database. This one builds each collection's
  indexes for real and compares what MongoDB ended up with against what the
  schema asked for.
*/
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/index-integrity-check";
process.env.JWT_SECRET ??= "check-only-secret-long-enough-to-pass";
process.env.LOG_LEVEL ??= "error";

import { readdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const api = new URL("../..", import.meta.url).pathname;

const mongod = await MongoMemoryServer.create();
const mongoose = (await import("mongoose")).default;
await mongoose.connect(mongod.getUri("indexintegrity"));

const checks = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
};

/* Every model, loaded the way the app loads them. */
for (const file of readdirSync(`${api}/models`).filter((name) => name.endsWith(".model.ts"))) {
  await import(`${api}/models/${file}`);
}

const models = Object.values(mongoose.models);
console.log(`Building indexes for ${models.length} models…\n`);

/** The options that change what the database ENFORCES, as against what it speeds up. */
const ENFORCING = ["unique", "partialFilterExpression", "expireAfterSeconds", "sparse"];

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A text index is not stored under the fields it names.
 *
 * MongoDB keys it `{ _fts: "text", _ftsx: 1 }` and records the fields in
 * `weights`, so comparing key patterns reports every text index as missing.
 * Matched by its weighted fields instead.
 */
const textFields = (key) =>
  Object.entries(key)
    .filter(([, value]) => value === "text")
    .map(([field]) => field)
    .sort();

const findLive = (live, key) => {
  const fields = textFields(key);

  if (fields.length > 0) {
    return live.find(
      (index) =>
        index.textIndexVersion !== undefined &&
        JSON.stringify(Object.keys(index.weights ?? {}).sort()) === JSON.stringify(fields),
    );
  }

  return live.find((index) => sameKey(index.key, key));
};

const problems = [];

for (const model of models) {
  /*
    MongoDB refuses a conflicting index rather than quietly ignoring it, so this
    throws on exactly the bug being looked for. Recorded rather than allowed to
    crash the run: a check that dies says less than one that names the model.
  */
  try {
    await model.syncIndexes();
  } catch (error) {
    problems.push(`${model.modelName}: syncIndexes refused — ${error.errorResponse?.errmsg ?? error.message}`);
  }

  const live = await model.collection.indexes();
  const declared = model.schema.indexes();

  /*
    A declared key pattern appearing twice is the bug itself: the second one's
    options were discarded before MongoDB ever saw them. Caught here as well as
    below, because the surviving definition sometimes happens to carry the
    options and the duplicate is then only a latent trap.
  */
  for (let i = 0; i < declared.length; i += 1) {
    for (let j = i + 1; j < declared.length; j += 1) {
      if (sameKey(declared[i][0], declared[j][0])) {
        problems.push(
          `${model.modelName}: ${JSON.stringify(declared[i][0])} is declared twice — ` +
            `Mongoose keeps the first and discards ${JSON.stringify(declared[j][1])}`,
        );
      }
    }
  }

  for (const [key, options = {}] of declared) {
    const match = findLive(live, key);

    if (!match) {
      problems.push(`${model.modelName}: ${JSON.stringify(key)} was never created`);
      continue;
    }

    for (const option of ENFORCING) {
      if (options[option] === undefined) continue;

      if (JSON.stringify(match[option]) !== JSON.stringify(options[option])) {
        problems.push(
          `${model.modelName}: ${JSON.stringify(key)} declares ${option}=` +
            `${JSON.stringify(options[option])} but the index has ` +
            `${JSON.stringify(match[option] ?? null)}`,
        );
      }
    }
  }
}

check("every declared index exists, with the options it declared", problems, []);

/*
  And the rule itself, end to end, because an index being present is not the
  same as the database refusing the thing it was added to refuse.
*/
const { PartnerApplicationModel } = await import(`${api}/models/partner-application.model.ts`);

const userId = new mongoose.Types.ObjectId();
const pending = { phone: "9876500000", requestedRole: "driver", status: "pending", userId };

await PartnerApplicationModel.create(pending);

let refused = false;
try {
  await PartnerApplicationModel.create(pending);
} catch (error) {
  refused = error.code === 11000;
}

check("a second open application is refused by the database", refused, true);
check(
  "so one person has exactly one",
  await PartnerApplicationModel.countDocuments({ status: "pending", userId }),
  1,
);

/* A decided application must not block the next one: the index is partial. */
await PartnerApplicationModel.updateOne({ userId }, { $set: { status: "rejected" } });
await PartnerApplicationModel.create(pending);
check(
  "and may apply again once the first is decided",
  await PartnerApplicationModel.countDocuments({ userId }),
  2,
);

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
