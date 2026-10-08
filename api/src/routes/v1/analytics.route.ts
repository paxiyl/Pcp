import { Router } from "express";

import { overviewController } from "../../controllers/analytics.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const analyticsRoutes = Router();

// Business figures are an admin view, never a customer or rider one.
analyticsRoutes.use(requireAuth, requireRole("admin"));

analyticsRoutes.get("/overview", overviewController);
