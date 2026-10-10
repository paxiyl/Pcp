// Exercises the settlement ledger against a real Mongo, because the arithmetic
// here moves actual money and reading it is not the same as running it.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("raketcheck");

process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = "check-only-secret-long-enough-to-pass";

const mongoose = (await import("mongoose")).default;
mongoose.set("sanitizeFilter", true);
await mongoose.connect(uri);

// Relative to this file, so the script runs from anywhere in the repo.
const api = new URL("../..", import.meta.url).pathname;
const { OrderModel } = await import(`${api}/models/order.model.ts`);
const { UserModel } = await import(`${api}/models/user.model.ts`);
const settle = await import(`${api}/services/settlement.service.ts`);
const demand = await import(`${api}/services/demand-signal.service.ts`);

const oid = () => new mongoose.Types.ObjectId();

const admin = await UserModel.create({
  email: "admin@check.local",
  name: "Admin",
  password: "check-password",
  role: "admin",
});
const rider = await UserModel.create({
  email: "rider@check.local",
  name: "Mohit R",
  password: "check-password",
  role: "driver",
});

const storeId = oid();
let seq = 0;

const order = async (over = {}) => {
  seq += 1;

  return OrderModel.create({
    commission: 4500,
    commissionRate: 0.1,
    contactName: "Customer",
    deliveryAddress: { city: "Hindaun City", line1: "House 24", postcode: "322230" },
    deliveryCode: "1234",
    deliveryFee: 3000,
    driver: { driverId: rider._id, name: rider.name },
    driverPayout: { base: 4000, distance: 0, distanceKm: 0, total: 4000 },
    estimatedDeliveryAt: new Date(),
    items: [{ name: "Atta 5kg", price: 45000, quantity: 1, unitPrice: 45000 }],
    paymentMethod: "cod",
    paymentProvider: "cod",
    prepTimeMaxMinutes: 30,
    prepTimeMinMinutes: 20,
    reference: `CHK-${seq}`,
    restaurantAddress: "Bazaar Road",
    restaurantImageUrl: "",
    restaurantName: "Sharma Kirana",
    restaurantPayout: 40500,
    serviceFee: 2000,
    status: "delivered",
    storeId,
    subtotal: 45000,
    total: 50000,
    userId: oid(),
    vendorKind: "store",
    codCollectedAt: new Date(),
    ...over,
  });
};

const money = (p) => `₹${(p / 100).toFixed(2)}`;
const checks = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
};

/* One cash order, collected. Rider took ₹500, earned ₹40. */
await order();

let out = await settle.getOutstanding();
check("riders listed", out.riders.length, 1);
check("cash collected", out.riders[0].cashCollected, 50000);
check("rider earnings", out.riders[0].earnings, 4000);
check("rider owes us", out.riders[0].net, 46000);
check("cash with riders total", out.totals.cashWithRiders, 46000);
check("shop owed", out.vendors[0].net, 40500);
check("our commission", out.vendors[0].commission, 4500);
check("owed to vendors total", out.totals.owedToVendors, 40500);

/* A prepaid order flips the rider's side: nothing collected, earnings owed. */
await order({ codCollectedAt: undefined, paymentMethod: "upi", paymentProvider: "razorpay" });

out = await settle.getOutstanding();
check("two orders on one rider", out.riders[0].orderCount, 2);
check("cash unchanged by prepaid", out.riders[0].cashCollected, 50000);
check("earnings now two deliveries", out.riders[0].earnings, 8000);
check("net after prepaid", out.riders[0].net, 42000);

/* A COD order never collected must NOT be billed to the rider. */
await order({ codCollectedAt: undefined });

out = await settle.getOutstanding();
check("uncollected cash not billed", out.riders[0].cashCollected, 50000);
check("earnings three deliveries", out.riders[0].earnings, 12000);

/* An order still in flight is invisible to settlement. */
await order({ reference: "CHK-FLIGHT", status: "out_for_delivery" });
out = await settle.getOutstanding();
check("in-flight order excluded", out.riders[0].orderCount, 3);

/* Settling with the wrong expected figure must be refused. */
let refused = false;
try {
  await settle.settleRider(rider._id.toString(), { expectedNet: 1, settledBy: admin._id.toString() });
} catch {
  refused = true;
}
check("stale figure refused", refused, true);

/* Settling for real. */
const { settlement } = await settle.settleRider(rider._id.toString(), {
  expectedNet: 38000,
  note: "Handed over at the shop",
  settledBy: admin._id.toString(),
});
check("settled amount", settlement.amount, 38000);
check("direction incoming", settlement.direction, "incoming");
check("orders covered", settlement.orderCount, 3);

out = await settle.getOutstanding();
check("rider cleared", out.riders.length, 0);
check("vendor still outstanding", out.vendors.length, 1);
check("vendor unaffected by rider leg", out.vendors[0].orderCount, 3);

/* Settling the same rider again has nothing to settle. */
let nothing = false;
try {
  await settle.settleRider(rider._id.toString(), { settledBy: admin._id.toString() });
} catch {
  nothing = true;
}
check("no double settle", nothing, true);

/* Vendor leg. */
const vendorRun = await settle.settleVendor("store", storeId.toString(), {
  expectedNet: 121500,
  settledBy: admin._id.toString(),
});
check("vendor paid", vendorRun.settlement.amount, 121500);
check("vendor direction", vendorRun.settlement.direction, "outgoing");

out = await settle.getOutstanding();
check("everything square", out.vendors.length, 0);

const history = await settle.listSettlements();
check("history has both runs", history.length, 2);

/* Demand signals. */
await demand.recordMiss({ mode: "food", term: "sushi" });
await demand.recordMiss({ mode: "food", term: "Sushi " });
await demand.recordMiss({ mode: "food", term: "sushi", asked: true });
await demand.recordMiss({ mode: "grocery", term: "sushi" });
await demand.recordMiss({ mode: "food", term: "ok" });
await demand.recordMiss({ mode: "food", term: "123456" });

const signals = await demand.listDemand();
const food = signals.find((s) => s.term === "sushi" && s.mode === "food");
check("demand rows", signals.length, 2);
check("case and space folded", food?.requests, 3);
check("deliberate asks counted apart", food?.askedCount, 1);
check("modes kept separate", signals.filter((s) => s.term === "sushi").length, 2);
check("short term ignored", signals.some((s) => s.term === "ok"), false);
check("digits-only ignored", signals.some((s) => s.term === "123456"), false);

/* Resolving removes it from the default list, asking again brings it back. */
await demand.setDemandResolved(food._id.toString(), true);
check("resolved hidden", (await demand.listDemand()).length, 1);
check("resolved visible on request", (await demand.listDemand({ includeResolved: true })).length, 2);
await demand.recordMiss({ mode: "food", term: "sushi", asked: true });
check("asking again un-resolves", (await demand.listDemand()).length, 2);

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((p) => !p).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
