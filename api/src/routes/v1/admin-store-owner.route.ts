import { Router } from "express";

import {
  createStoreOwnerController,
  deactivateStoreOwnerController,
  listStoreOwnersController,
  updateStoreOwnerController,
} from "../../controllers/admin-store-owner.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminStoreOwnerRoutes = Router();

// Creating accounts with a role attached is an admin-only act, full stop.
adminStoreOwnerRoutes.use(requireAuth, requireRole("admin"));

adminStoreOwnerRoutes.get("/", listStoreOwnersController);
adminStoreOwnerRoutes.post("/", createStoreOwnerController);
adminStoreOwnerRoutes.patch("/:ownerId", updateStoreOwnerController);
adminStoreOwnerRoutes.delete("/:ownerId", deactivateStoreOwnerController);
