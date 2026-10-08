import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * One-off: riders created before the approval field existed were already
 * working the queue, so they keep working it.
 *
 * Run with: npx tsx ./src/scripts/approve-existing-riders.ts
 */
const run = async () => {
  await connectDatabase();

  const result = await UserModel.updateMany(
    { role: "driver", driverStatus: mongoose.trusted({ $exists: false }) },
    { $set: { driverStatus: "approved" } },
  ).exec();

  logger.info("Back-filled rider approval", { approved: result.modifiedCount });

  await disconnectDatabase();
};

void run();
