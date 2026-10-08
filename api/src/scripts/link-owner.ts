import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { RestaurantModel } from "../models/restaurant.model";
import { StoreModel } from "../models/store.model";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * Creates or converts an account into a shop or restaurant owner and links it
 * to the venue it runs.
 *
 * The backoffice can already do this for shops; restaurants have no screen for
 * it yet, and a pilot needs one or two owners rather than an onboarding flow.
 * This is the stopgap, not the destination.
 *
 *   npx tsx src/scripts/link-owner.ts \
 *     --email owner@example.com --password secret123 \
 *     --role restaurant_owner --slug sharma-bhojnalaya
 *
 * --name is optional. An existing account is converted in place, keeping its
 * password; a new one is created with the password given.
 */
const arg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);

  return index === -1 ? undefined : process.argv[index + 1];
};

const linkOwner = async () => {
  const email = arg("email")?.trim().toLowerCase();
  const role = arg("role");
  const slug = arg("slug")?.trim();
  const password = arg("password");
  const name = arg("name");

  if (!email || !slug) throw new Error("--email and --slug are required");
  if (role !== "store_owner" && role !== "restaurant_owner") {
    throw new Error("--role must be store_owner or restaurant_owner");
  }

  await connectDatabase();

  const venue =
    role === "store_owner"
      ? await StoreModel.findOne({ slug }).exec()
      : await RestaurantModel.findOne({ slug }).exec();

  if (!venue) throw new Error(`No ${role === "store_owner" ? "store" : "restaurant"} with slug "${slug}"`);

  const existing = await UserModel.findOne({ email }).exec();
  // Only one venue per account: clear the other side so converting a shop
  // owner into a restaurant owner cannot leave them holding both.
  const link =
    role === "store_owner"
      ? { $set: { role, storeId: venue._id }, $unset: { restaurantId: "" } }
      : { $set: { restaurantId: venue._id, role }, $unset: { storeId: "" } };

  if (existing) {
    await UserModel.updateOne({ _id: existing._id }, link).exec();
    logger.info("Existing account linked", { email, role, venue: venue.name });
  } else {
    if (!password) throw new Error("--password is required when creating a new account");

    const user = await UserModel.create({
      email,
      name: name ?? venue.name,
      password,
      role,
    });

    await UserModel.updateOne({ _id: user._id }, link).exec();
    logger.info("Account created and linked", { email, role, venue: venue.name });
  }

  await disconnectDatabase();
};

linkOwner().catch(async (error: unknown) => {
  logger.error("Link failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });

  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
