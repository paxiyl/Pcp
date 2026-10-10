/*
  `reset:demo` must leave no owner pointing at a shop or kitchen it deleted.

  Its unlink used a bare `{ $exists: true }`, which `sanitizeFilter` casts to a
  literal — so it matched nothing, reported success, and left exactly the
  dangling references its own comment says it prevents. It also never touched
  `restaurantId` at all. This is the check that would have caught both.
*/
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("resetcheck");

const env = {
  ...process.env,
  JWT_SECRET: "check-only-secret-long-enough-to-pass",
  LOG_LEVEL: "error",
  MONGODB_URI: uri,
};

const api = new URL("../..", import.meta.url).pathname;

const run = (script, args = []) =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", `${api}/scripts/${script}`, ...args], {
      env,
      stdio: "ignore",
    });

    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} → ${code}`))));
  });

const mongoose = (await import("mongoose")).default;
mongoose.set("sanitizeFilter", true);

const checks = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
};

console.log("Seeding a catalogue with linked owners…");
await run("seed-categories.ts");
await run("seed-restaurants.ts");
await run("seed-stores.ts");

await mongoose.connect(uri);

const { UserModel } = await import(`${api}/models/user.model.ts`);
const { StoreModel } = await import(`${api}/models/store.model.ts`);
const { RestaurantModel } = await import(`${api}/models/restaurant.model.ts`);
const { CategoryModel } = await import(`${api}/models/category.model.ts`);
const { ProductCategoryModel } = await import(`${api}/models/product-category.model.ts`);

const store = await StoreModel.findOne({}).exec();
const restaurant = await RestaurantModel.findOne({}).exec();

// Two owners, each linked, exactly as link:owner or an approval would leave them.
await UserModel.create({
  email: "shopowner@check.local",
  name: "Shop Owner",
  password: "password1234",
  role: "store_owner",
  storeId: store._id,
});
await UserModel.create({
  email: "kitchenowner@check.local",
  name: "Kitchen Owner",
  password: "password1234",
  restaurantId: restaurant._id,
  role: "restaurant_owner",
});

const beforeCategories = await CategoryModel.countDocuments({});
const beforeProductCategories = await ProductCategoryModel.countDocuments({});

check("a shop owner is linked before the reset", Boolean(store && restaurant), true);

await mongoose.disconnect();

console.log("Running reset:demo…");
await run("reset-demo-data.ts");

await mongoose.connect(uri);

check("stores are gone", await StoreModel.countDocuments({}), 0);
check("kitchens are gone", await RestaurantModel.countDocuments({}), 0);

const shopOwner = await UserModel.findOne({ email: "shopowner@check.local" }).exec();
const kitchenOwner = await UserModel.findOne({ email: "kitchenowner@check.local" }).exec();

check("the shop owner's account survives", Boolean(shopOwner), true);
check("the kitchen owner's account survives", Boolean(kitchenOwner), true);

// The whole point: no reference left pointing at something deleted.
check("the shop owner is unlinked", shopOwner?.storeId ?? null, null);
check("the kitchen owner is unlinked", kitchenOwner?.restaurantId ?? null, null);

// And the things the script promises to keep.
check("restaurant categories are kept", await CategoryModel.countDocuments({}), beforeCategories);
check(
  "product categories are kept",
  await ProductCategoryModel.countDocuments({}),
  beforeProductCategories,
);

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
