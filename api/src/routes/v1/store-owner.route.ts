import { Router } from "express";

import {
  advanceStoreOrderController,
  createStoreProductController,
  deleteStoreProductController,
  setStoreOpenController,
  storeOrdersController,
  storeOverviewController,
  storeProductsController,
  updateStoreProductController,
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
storeOwnerRoutes.post("/products", createStoreProductController);
// PATCH stays stock-and-listing only, which is what the shop screen's quick
// toggles send. PUT is the full edit from the product form.
storeOwnerRoutes.patch("/products/:productId", updateStoreStockController);
storeOwnerRoutes.put("/products/:productId", updateStoreProductController);
storeOwnerRoutes.delete("/products/:productId", deleteStoreProductController);
