import { Router } from "express";

import {
  advanceStoreOrderController,
  setStoreOpenController,
  storeOrdersController,
  storeOverviewController,
  storeProductsController,
  updateStoreStockController,
} from "../../controllers/store-owner.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const storeOwnerRoutes = Router();

/**
 * Shopkeeper-only. Every handler scopes its own queries to the store attached to
 * the account — the role check gets you through the door, it does not decide
 * which shop you can see.
 */
storeOwnerRoutes.use(requireAuth, requireRole("store_owner"));

storeOwnerRoutes.get("/overview", storeOverviewController);
storeOwnerRoutes.patch("/open", setStoreOpenController);

storeOwnerRoutes.get("/orders", storeOrdersController);
storeOwnerRoutes.patch("/orders/:orderId", advanceStoreOrderController);

storeOwnerRoutes.get("/products", storeProductsController);
storeOwnerRoutes.patch("/products/:productId", updateStoreStockController);
