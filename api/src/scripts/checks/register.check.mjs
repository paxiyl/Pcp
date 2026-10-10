// Registration as a partner, which is the "I signed up as a kitchen and it
// logged me in as a customer" report. The account must stay a customer AND an
// application must exist, in one request, or neither.
import { MongoMemoryServer } from "mongodb-memory-server";

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("registercheck");

process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = "check-only-secret-long-enough-to-pass";

const mongoose = (await import("mongoose")).default;
mongoose.set("sanitizeFilter", true);
await mongoose.connect(uri);

const api = new URL("../..", import.meta.url).pathname;
const { registerUser } = await import(`${api}/services/auth.service.ts`);
const { UserModel } = await import(`${api}/models/user.model.ts`);
const { PartnerApplicationModel } = await import(`${api}/models/partner-application.model.ts`);
const { RestaurantModel } = await import(`${api}/models/restaurant.model.ts`);
const { reviewApplication } = await import(`${api}/services/partner-application.service.ts`);

const checks = [];
const check = (label, actual, expected) => {
  const pass = actual === expected;
  checks.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
};
const refuses = async (label, fn, expected) => {
  try {
    await fn();
    check(label, "no error", expected);
  } catch (error) {
    check(label, error.message, expected);
  }
};

/* A plain customer. */
let result = await registerUser({
  email: "shopper@check.local",
  name: "Plain Shopper",
  password: "password1234",
});
check("customer role", result.user.role, "customer");
check("no application for a customer", result.application, undefined);

/* A kitchen. The account stays a customer; an application appears. */
result = await registerUser({
  businessName: "Hindaun Tandoori",
  email: "kitchen@check.local",
  joinAs: "restaurant_owner",
  name: "Kitchen Owner",
  password: "password1234",
  phone: "9876543210",
});
check("kitchen signup is still a customer", result.user.role, "customer");
check("application returned", result.application?.requestedRole, "restaurant_owner");
check("application is pending", result.application?.status, "pending");
check("business name kept", result.application?.businessName, "Hindaun Tandoori");
check(
  "application is in the database",
  await PartnerApplicationModel.countDocuments({ userId: result.user._id }),
  1,
);

/* A rider needs no business name. */
result = await registerUser({
  email: "rider@check.local",
  joinAs: "driver",
  name: "Rider",
  password: "password1234",
  phone: "9876543211",
  vehicle: "Splendor",
});
check("rider application", result.application?.requestedRole, "driver");
check("vehicle kept", result.application?.vehicle, "Splendor");

/* A shop or kitchen without a name is refused BEFORE the account exists. */
await refuses(
  "kitchen with no name refused",
  () =>
    registerUser({
      email: "nameless@check.local",
      joinAs: "restaurant_owner",
      name: "Nameless",
      password: "password1234",
      phone: "9876543212",
    }),
  "Tell us the name of your shop or kitchen",
);
check(
  "no orphan account left behind",
  await UserModel.countDocuments({ email: "nameless@check.local" }),
  0,
);

/* A partner signup with no phone is refused: we cannot reach them. */
await refuses(
  "partner with no phone refused",
  () =>
    registerUser({
      businessName: "No Phone Kirana",
      email: "nophone@check.local",
      joinAs: "store_owner",
      name: "No Phone",
      password: "password1234",
    }),
  "We need a phone number to reach you about your application",
);

/* A duplicate email is still refused, and is the case that used to burn the
   rate-limit budget. */
await refuses(
  "duplicate email refused",
  () =>
    registerUser({
      email: "kitchen@check.local",
      name: "Someone Else",
      password: "password1234",
    }),
  "An account with this email already exists",
);

/* Approving the kitchen application grants the role and mints the kitchen. */
const pending = await PartnerApplicationModel.findOne({
  requestedRole: "restaurant_owner",
  status: "pending",
}).exec();
const admin = await UserModel.create({
  email: "admin@check.local",
  name: "Admin",
  password: "password1234",
  role: "admin",
});

await reviewApplication(admin, pending._id.toString(), { status: "approved" });

const granted = await UserModel.findById(pending.userId).exec();
check("approval grants the role", granted.role, "restaurant_owner");
check("account is linked to a kitchen", Boolean(granted.restaurantId), true);

const kitchen = await RestaurantModel.findById(granted.restaurantId).exec();
check("kitchen named from the application", kitchen?.name, "Hindaun Tandoori");

await mongoose.disconnect();
await mongod.stop();

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
