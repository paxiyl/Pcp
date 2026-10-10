import { Router } from "express";

import {
  outstandingController,
  settleRiderController,
  settleVendorController,
  settlementHistoryController,
} from "../../controllers/settlement.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const settlementRoutes = Router();

// Money movement, so admin only — a rider must not be able to mark their own
// cash as handed in, and a shop must not be able to mark itself as paid.
settlementRoutes.use(requireAuth, requireRole("admin"));

settlementRoutes.get("/outstanding", outstandingController);
settlementRoutes.get("/history", settlementHistoryController);
settlementRoutes.post("/riders/:riderId", settleRiderController);
settlementRoutes.post("/vendors/:kind/:vendorId", settleVendorController);
