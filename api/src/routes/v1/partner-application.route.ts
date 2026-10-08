import { Router } from "express";

import {
  applyController,
  listApplicationsController,
  myApplicationController,
  reviewApplicationController,
} from "../../controllers/partner-application.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

/**
 * Applying to become a shop, a kitchen or a rider.
 *
 * Signing up still only ever makes a customer. This is how someone asks to be
 * more than that, and an admin is the only thing that can grant it.
 */
export const partnerApplicationRoutes = Router();

partnerApplicationRoutes.use(requireAuth);

partnerApplicationRoutes.post("/", applyController);
partnerApplicationRoutes.get("/mine", myApplicationController);

export const adminApplicationRoutes = Router();

adminApplicationRoutes.use(requireAuth, requireRole("admin"));

adminApplicationRoutes.get("/", listApplicationsController);
adminApplicationRoutes.patch("/:applicationId", reviewApplicationController);
