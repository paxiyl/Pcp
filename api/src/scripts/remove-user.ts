import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * Deletes one account by email. Useful for clearing a test rider or customer.
 *
 * Run with: npx tsx ./src/scripts/remove-user.ts someone@example.com
 */
const run = async () => {
  const email = process.argv[2];

  if (!email) throw new Error("Pass the email to remove");

  await connectDatabase();

  const result = await UserModel.deleteOne({ email: email.toLowerCase() }).exec();

  logger.info("Removed user", { deleted: result.deletedCount, email });

  await disconnectDatabase();
};

void run();
