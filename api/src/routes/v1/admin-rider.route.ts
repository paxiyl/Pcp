import { Router } from "express";

import {
  createRiderController,
  listRidersController,
  updateRiderController,
} from "../../controllers/admin-rider.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminRiderRoutes = Router();

adminRiderRoutes.use(requireAuth, requireRole("admin"));

adminRiderRoutes.get("/", listRidersController);
adminRiderRoutes.post("/", createRiderController);
adminRiderRoutes.patch("/:riderId", updateRiderController);
