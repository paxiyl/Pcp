// Runs the real seeders against a throwaway Mongo, because a seeder that
// typechecks and then throws on the first write is worth nothing.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("seedcheck");

process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = "check-only-secret-long-enough-to-pass";

const mongoose = (await import("mongoose")).default;
mongoose.set("sanitizeFilter", true);
await mongoose.connect(uri);

const api = new URL("../..", import.meta.url).pathname;
const { CategoryModel } = await import(`${api}/models/category.model.ts`);
const { RestaurantModel } = await import(`${api}/models/restaurant.model.ts`);
const { DishModel } = await import(`${api}/models/dish.model.ts`);
const { IMAGE_PRESETS } = await import(`${api}/config/image-presets.ts`);

/*
  The seeders self-execute on import and manage their own connection, so this
  imports them in the order an operator runs them. Categories FIRST: without
  them the restaurant seeder has nothing to file a kitchen under, which is a
  real failure mode and one this check exists to catch.
*/
await import(`${api}/scripts/seed-categories.ts`);
await new Promise((resolve) => setTimeout(resolve, 3000));

if (mongoose.connection.readyState !== 1) await mongoose.connect(uri);

await import(`${api}/scripts/seed-restaurants.ts`);

const checks = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
};

// The script self-executes on import, including its own connect/disconnect.
// Give it a moment, then reconnect and inspect what it wrote.
await new Promise((resolve) => setTimeout(resolve, 4000));

if (mongoose.connection.readyState !== 1) await mongoose.connect(uri);

const restaurants = await RestaurantModel.find({}).sort({ sortOrder: 1 }).exec();
const dishes = await DishModel.find({}).exec();

console.log(`\nSeeded ${restaurants.length} kitchens, ${dishes.length} dishes`);
console.log(restaurants.map((r) => `  ${r.name} (${r.isPureVeg ? "pure veg" : "mixed"})`).join("\n"));

check("kitchens seeded", restaurants.length, 6);
check("no London data", restaurants.some((r) => /London|Italia|Sushi|Poké/.test(r.name + r.address)), false);
check("every kitchen has a Hindaun address", restaurants.every((r) => /Hindaun/.test(r.address)), true);
check("pure veg kitchens marked", restaurants.filter((r) => r.isPureVeg).length, 2);

check("dishes seeded", dishes.length > 0, true);
check("every dish has a veg mark", dishes.every((d) => typeof d.isVeg === "boolean"), true);
check("both veg and non-veg present", new Set(dishes.map((d) => d.isVeg)).size, 2);

const presetKeys = new Set(IMAGE_PRESETS.map((p) => p.key));
const bad = dishes.filter((d) => d.imagePreset && !presetKeys.has(d.imagePreset));
check("every preset key is real", bad.map((d) => `${d.name}:${d.imagePreset}`).join(","), "");
check("every dish has a preset", dishes.every((d) => Boolean(d.imagePreset)), true);

const categories = await CategoryModel.find({}).exec();
check("kitchens are filed under categories", restaurants.every((r) => r.categories.length > 0), true);
console.log(`(${categories.length} restaurant categories)`);

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
