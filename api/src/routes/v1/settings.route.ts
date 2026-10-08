import { Router } from "express";

import {
  getSettingsController,
  updateSettingsController,
} from "../../controllers/settings.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const settingsRoutes = Router();

// Platform pay rates are an admin control, never a customer or rider one.
settingsRoutes.use(requireAuth, requireRole("admin"));

settingsRoutes.get("/", getSettingsController);
settingsRoutes.patch("/", updateSettingsController);
