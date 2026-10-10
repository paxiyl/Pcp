import { Router } from "express";

import {
  advanceKitchenOrderController,
  createRestaurantDishController,
  deleteRestaurantDishController,
  restaurantDishesController,
  kitchenOrdersController,
  restaurantOverviewController,
  setRestaurantOpenController,
  updateRestaurantDishController,
} from "../../controllers/restaurant-owner.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const restaurantOwnerRoutes = Router();

/**
 * Restaurant-only, and the counterpart of storeOwnerRoutes. Every handler
 * scopes its own queries to the restaurant attached to the account — the role
 * check gets you through the door, it does not decide which kitchen you see.
 */
restaurantOwnerRoutes.use(requireAuth, requireRole("restaurant_owner"));

restaurantOwnerRoutes.get("/overview", restaurantOverviewController);
restaurantOwnerRoutes.patch("/open", setRestaurantOpenController);

restaurantOwnerRoutes.get("/orders", kitchenOrdersController);
restaurantOwnerRoutes.patch("/orders/:orderId", advanceKitchenOrderController);

restaurantOwnerRoutes.get("/dishes", restaurantDishesController);
restaurantOwnerRoutes.post("/dishes", createRestaurantDishController);
restaurantOwnerRoutes.put("/dishes/:dishId", updateRestaurantDishController);
restaurantOwnerRoutes.delete("/dishes/:dishId", deleteRestaurantDishController);
