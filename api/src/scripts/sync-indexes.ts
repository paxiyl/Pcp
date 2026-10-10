/**
 * Bring the database's indexes in line with the schemas.
 *
 * Run once after an index definition changes. The app does NOT do this on boot:
 * `autoIndex` runs `createIndexes`, which only ADDS. It cannot replace an index
 * whose definition has changed, and when the change collides with an existing
 * name MongoDB refuses it outright — IndexKeySpecsConflict, logged among the
 * startup lines and then forgotten, leaving the old index in place and the new
 * rule unenforced. That is exactly what happened to the partial unique index on
 * `PartnerApplication.userId`, the one stopping an account from filing two open
 * applications at once.
 *
 *   npm run sync:indexes
 *
 * `syncIndexes` DROPS any index that is not in the schema, which is why this is
 * a deliberate command and not something that runs by itself: an index added by
 * hand against a live performance problem would go with it. It prints what it
 * dropped so there is a record.
 *
 * Building an index locks nothing on a modern MongoDB, but it does read the
 * whole collection. On a large one, run it when the shop is quiet.
 */
import "dotenv/config";
import { readdirSync } from "node:fs";
import path from "node:path";

import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { logger } from "../utils/logger";

const main = async () => {
  await connectDatabase();

  // Imported by directory rather than named one by one: a model added later
  // should be covered without anybody remembering to add it here.
  const modelsDir = path.resolve(__dirname, "../models");

  for (const file of readdirSync(modelsDir).filter((name) => name.endsWith(".model.ts") || name.endsWith(".model.js"))) {
    await import(path.join(modelsDir, file));
  }

  const models = Object.values(mongoose.models);
  logger.info("Syncing indexes", { models: models.length });

  let dropped = 0;
  let failed = 0;

  for (const model of models) {
    try {
      const removed = await model.syncIndexes();

      if (removed.length > 0) {
        dropped += removed.length;
        logger.info("Replaced index", { dropped: removed, model: model.modelName });
      }
    } catch (error) {
      failed += 1;
      logger.error("Could not sync indexes", {
        error: error instanceof Error ? error.message : String(error),
        model: model.modelName,
      });
    }
  }

  logger.info("Index sync complete", { dropped, failed, models: models.length });

  await disconnectDatabase();

  // Non-zero on failure, so this cannot pass unnoticed in a deploy script.
  process.exit(failed === 0 ? 0 : 1);
};

main().catch((error) => {
  logger.error("Index sync failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
