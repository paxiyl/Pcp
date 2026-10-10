import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.config";
import { BannerModel } from "../models/banner.model";
import { BasketModel } from "../models/basket.model";
import { DishModel } from "../models/dish.model";
import { OrderModel } from "../models/order.model";
import { PaymentEventModel } from "../models/payment-event.model";
import { ProductModel } from "../models/product.model";
import { RestaurantModel } from "../models/restaurant.model";
import { StoreModel } from "../models/store.model";
import { UserModel } from "../models/user.model";
import { logger } from "../utils/logger";

/**
 * Clears the seeded demo catalogue so a real one can be entered in its place.
 *
 * Deliberately keeps three things:
 *  - Categories, both product and restaurant, so real products have shelves to
 *    sit on from the first day rather than needing the taxonomy rebuilt.
 *  - Users, so the admin account still works and nobody is locked out.
 *  - Platform settings, which hold the rider pay rates.
 *
 * Shop owners are unlinked rather than deleted: the account survives, but its
 * storeId is cleared because the store it pointed at no longer exists. Leaving
 * a dangling reference would let an owner sign in to a shop that is gone.
 *
 * Run with: npm run reset:demo
 */
const resetDemoData = async () => {
  await connectDatabase();

  const cleared = {
    baskets: (await BasketModel.deleteMany({})).deletedCount,
    banners: (await BannerModel.deleteMany({})).deletedCount,
    dishes: (await DishModel.deleteMany({})).deletedCount,
    orders: (await OrderModel.deleteMany({})).deletedCount,
    paymentEvents: (await PaymentEventModel.deleteMany({})).deletedCount,
    products: (await ProductModel.deleteMany({})).deletedCount,
    restaurants: (await RestaurantModel.deleteMany({})).deletedCount,
    stores: (await StoreModel.deleteMany({})).deletedCount,
  };

  /*
    `mongoose.trusted` is required, not decorative: `sanitizeFilter` is set
    globally in database.config, so a bare `{ $exists: true }` is cast to a
    LITERAL and matches nothing. This update silently unlinked zero accounts and
    logged that it had done its job — leaving owners pointing at stores that no
    longer exist, which is the exact thing the comment at the top of this file
    says it prevents. An owner in that state signs in and gets "Store not
    found" instead of the friendly "not linked yet" message.

    `restaurantId` was never unlinked at all, so kitchen owners kept a dangling
    reference even when this did work.
  */
  const unlinked = await UserModel.updateMany(
    {
      $or: [
        { storeId: mongoose.trusted({ $exists: true }) },
        { restaurantId: mongoose.trusted({ $exists: true }) },
      ],
    },
    { $unset: { restaurantId: "", storeId: "" } },
  );

  logger.info("Demo data cleared", cleared);
  logger.info("Owners unlinked from deleted shops and kitchens", {
    accounts: unlinked.modifiedCount,
  });
  logger.info("Kept: categories, users, settings");

  await disconnectDatabase();
};

resetDemoData().catch(async (error: unknown) => {
  logger.error("Demo reset failed", {
    error: error instanceof Error ? error.message : "Unknown error",
  });

  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
