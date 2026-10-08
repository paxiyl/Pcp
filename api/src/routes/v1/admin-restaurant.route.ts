import { Router } from "express";

import {
  getAdminRestaurantController,
  listAdminRestaurantsController,
} from "../../controllers/admin-restaurant.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminRestaurantRoutes = Router();

adminRestaurantRoutes.use(requireAuth, requireRole("admin"));

// Writes stay on /restaurants, which is already admin-guarded; this is the
// backoffice's richer read: order volume, commission and counts.
adminRestaurantRoutes.get("/", listAdminRestaurantsController);
adminRestaurantRoutes.get("/:id", getAdminRestaurantController);
