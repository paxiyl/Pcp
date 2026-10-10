// The notification hook sits on the order save path, and Firebase is not
// configured here. A throw in that hook would break every status update, so it
// is worth proving it stays quiet rather than assuming.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("hookcheck");

process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = "check-only-secret-long-enough-to-pass";
process.env.FIREBASE_SERVICE_ACCOUNT = "";

const mongoose = (await import("mongoose")).default;
mongoose.set("sanitizeFilter", true);
await mongoose.connect(uri);

// Relative to this file, so the script runs from anywhere in the repo.
const api = new URL("../..", import.meta.url).pathname;
const { OrderModel } = await import(`${api}/models/order.model.ts`);
const { UserModel } = await import(`${api}/models/user.model.ts`);
const prefs = await import(`${api}/services/payment-preference.service.ts`);

const oid = () => new mongoose.Types.ObjectId();
const checks = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
};

const customer = await UserModel.create({
  email: "customer@check.local",
  name: "Customer",
  password: "check-password",
  role: "customer",
});

/* Payment preferences default before anyone chooses. */
let p = await prefs.getPaymentPreferences(customer._id.toString());
check("default method", p.preferred, "upi");
check("not yet explicit", p.isExplicit, false);
check("five methods offered", p.methods.length, 5);
check("cash offered by default policy", p.cod.available, true);

p = await prefs.setPreferredPaymentMethod(customer._id.toString(), "cod");
check("cash saved", p.preferred, "cod");
check("now explicit", p.isExplicit, true);

p = await prefs.setPreferredPaymentMethod(customer._id.toString(), "card");
check("changed to card", p.preferred, "card");

/* An order moving through every status must not throw, with no Firebase. */
const order = await OrderModel.create({
  commission: 4500,
  commissionRate: 0.1,
  contactName: "Customer",
  deliveryAddress: { city: "Hindaun City", line1: "House 24", postcode: "322230" },
  deliveryCode: "1234",
  deliveryFee: 3000,
  estimatedDeliveryAt: new Date(),
  items: [{ name: "Atta 5kg", price: 45000, quantity: 1, unitPrice: 45000 }],
  paymentMethod: "cod",
  paymentProvider: "cod",
  prepTimeMaxMinutes: 30,
  prepTimeMinMinutes: 20,
  reference: "HOOK-1",
  restaurantAddress: "Bazaar Road",
  restaurantImageUrl: "",
  restaurantName: "Sharma Kirana",
  restaurantPayout: 40500,
  serviceFee: 2000,
  status: "pending_payment",
  storeId: oid(),
  subtotal: 45000,
  total: 50000,
  userId: customer._id,
  vendorKind: "store",
});

let threw = null;

for (const status of ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"]) {
  try {
    order.status = status;
    await order.save();
  } catch (error) {
    threw = `${status}: ${error.message}`;
    break;
  }
}

check("status walk survives no Firebase", threw, null);
check("final status stored", order.status, "delivered");

/* A customer with a push token but no Firebase must also be harmless. */
customer.pushTokens = ["fake-token-that-goes-nowhere"];
await customer.save();

try {
  order.status = "cancelled";
  await order.save();
  check("save with a token present", true, true);
} catch (error) {
  check("save with a token present", error.message, true);
}

/* A preference the policy forbids must not be handed back. */
const { SettingsModel } = await import(`${api}/models/settings.model.ts`);
// getCodPolicy already created the singleton, so upsert rather than insert.
await SettingsModel.updateOne({ key: "platform" }, { $set: { codEnabled: false } }, { upsert: true });
await prefs.setPreferredPaymentMethod(customer._id.toString(), "cod");
p = await prefs.getPaymentPreferences(customer._id.toString());
check("cash default dropped when cash is off", p.preferred, "upi");
check("cash row marked unavailable", p.methods.find((m) => m.method === "cod").available, false);

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
