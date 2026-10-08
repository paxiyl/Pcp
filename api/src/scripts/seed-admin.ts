import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { UserModel } from "../models/user.model";
import { getSettings } from "../services/settings.service";
import { logger } from "../utils/logger";

/**
 * Creates the admin account and makes sure the platform settings document
 * exists, so the rider pay rates are editable straight away.
 *
 * Run with: npm run seed:admin
 */

const ADMIN = {
  email: "admin@chowly.app",
  name: "Chowly Admin",
  password: "chowly12345",
};

const seedAdmin = async () => {
  await connectDatabase();

  const existing = await UserModel.findOne({ email: ADMIN.email }).exec();

  if (existing) {
    existing.name = ADMIN.name;
    existing.role = "admin";
    existing.isActive = true;
    // Re-set the password so a forgotten test login is always recoverable.
    existing.password = ADMIN.password;

    await existing.save();
    logger.info("Updated admin", { email: ADMIN.email });
  } else {
    await UserModel.create({ ...ADMIN, role: "admin" });
    logger.info("Created admin", { email: ADMIN.email });
  }

  const settings = await getSettings();

  logger.info("Platform settings ready", {
    driverBasePay: settings.driverBasePay,
    driverPayPerKm: settings.driverPayPerKm,
  });

  await disconnectDatabase();
};

seedAdmin().catch(async (error: unknown) => {
  logger.error("Admin seed failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });

  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
