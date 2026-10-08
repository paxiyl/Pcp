import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { OrderModel } from "../models/order.model";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * Creates the test rider account and, optionally, puts something in the queue.
 *
 * Nothing moves an order from `confirmed` to `ready` yet — that is the admin
 * app's job in M3 — so `--ready` promotes recent paid orders so the driver home
 * screen has real deliveries to claim.
 *
 * Run with: npm run seed:driver          (account only)
 *           npm run seed:driver -- --ready   (account + fill the queue)
 */

const DRIVER = {
  email: "driver@chowly.app",
  name: "Kris Clent",
  password: "chowly12345",
  phone: "+44 7700 900321",
  rating: 4.9,
  ratingCount: 214,
};

const seedDriver = async () => {
  await connectDatabase();

  const existing = await UserModel.findOne({ email: DRIVER.email }).exec();

  if (existing) {
    existing.name = DRIVER.name;
    existing.phone = DRIVER.phone;
    existing.rating = DRIVER.rating;
    existing.ratingCount = DRIVER.ratingCount;
    existing.role = "driver";
    existing.isActive = true;
    // The test rider is vetted, so the queue is usable straight after seeding.
    existing.driverStatus = "approved";
    // Re-set the password so a forgotten test login is always recoverable.
    existing.password = DRIVER.password;

    await existing.save();
    logger.info("Updated test driver", { email: DRIVER.email });
  } else {
    await UserModel.create({ ...DRIVER, driverStatus: "approved", role: "driver" });
    logger.info("Created test driver", { email: DRIVER.email });
  }

  if (process.argv.includes("--ready")) {
    const result = await OrderModel.updateMany(
      {
        driver: mongoose.trusted({ $exists: false }),
        status: mongoose.trusted({ $in: ["confirmed", "preparing"] }),
      },
      {
        $set: { status: "ready" },
        $push: {
          statusHistory: { at: new Date(), note: "Ready for collection", status: "ready" },
        },
      },
    ).exec();

    logger.info("Promoted paid orders to ready", { count: result.modifiedCount });
  }

  await disconnectDatabase();
};

seedDriver().catch(async (error: unknown) => {
  logger.error("Driver seed failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });

  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
