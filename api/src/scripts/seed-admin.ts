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

/**
 * Pass your own and nothing is left at a default:
 *
 *   npm run seed:admin -- --email you@example.com --password "something long"
 *
 * Without arguments it falls back to the demo account below, whose password is
 * committed in this repository and therefore public. That is fine on a laptop
 * and unsafe the moment the API has a domain.
 */
const arg = (flag: string): string | undefined => {
  const index = process.argv.indexOf(`--${flag}`);

  return index === -1 ? undefined : process.argv[index + 1];
};

const DEFAULTS = {
  email: "admin@chowly.app",
  name: "Chowly Admin",
  password: "chowly12345",
};

const ADMIN = {
  email: (arg("email") ?? DEFAULTS.email).trim().toLowerCase(),
  name: arg("name") ?? DEFAULTS.name,
  password: arg("password") ?? DEFAULTS.password,
};

const usingDefaults = ADMIN.password === DEFAULTS.password;

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

  if (usingDefaults) {
    logger.warn(
      "Admin password is the committed default. Anyone who can read this repository can sign in. " +
        'Re-run with: npm run seed:admin -- --email you@example.com --password "something long"',
    );
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
