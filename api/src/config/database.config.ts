import mongoose from "mongoose";

import { logger } from "../utils/logger";
import { Env } from "./env.config";

/**
 * Defence in depth against query-selector injection: filters can never carry
 * operators that did not come from server code. Set before the first query.
 */
mongoose.set("sanitizeFilter", true);

export const connectDatabase = async (): Promise<void> => {
  try {
    const connection = await mongoose.connect(Env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });

    logger.info("Database connected", { host: connection.connection.host });
  } catch (error) {
    logger.error("Database connection failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info("Database disconnected");
};
