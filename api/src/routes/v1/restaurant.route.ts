import { Router } from "express";

import {
  createDishController,
  createRestaurantController,
  deleteDishController,
  deleteRestaurantController,
  getDishController,
  getRestaurantController,
  listRestaurantsController,
  updateDishController,
  updateRestaurantController,
} from "../../controllers/restaurant.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const restaurantRoutes = Router();

// Browsing is public; only the backoffice writes.
restaurantRoutes.get("/", listRestaurantsController);
restaurantRoutes.get("/:slug", getRestaurantController);

const adminOnly = [requireAuth, requireRole("admin")] as const;

restaurantRoutes.post("/", ...adminOnly, createRestaurantController);
restaurantRoutes.patch("/:id", ...adminOnly, updateRestaurantController);
restaurantRoutes.delete("/:id", ...adminOnly, deleteRestaurantController);

restaurantRoutes.post("/:id/dishes", ...adminOnly, createDishController);

export const dishRoutes = Router();

// Public: the dish sheet is part of browsing.
dishRoutes.get("/:id", getDishController);

dishRoutes.patch("/:id", ...adminOnly, updateDishController);
dishRoutes.delete("/:id", ...adminOnly, deleteDishController);
