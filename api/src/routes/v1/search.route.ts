import { Router } from "express";

import {
  listDemandController,
  requestItemController,
  resolveDemandController,
  searchController,
} from "../../controllers/search.controller";
import { attachUser, requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const searchRoutes = Router();

// Browsing is public, and so is searching it. The user is attached when there
// is one so an unmet search can be attributed, but never required.
searchRoutes.get("/", attachUser, searchController);

// Asking for something we do not sell is open to guests too: a customer who has
// not signed up yet is exactly the one worth listening to.
searchRoutes.post("/requests", attachUser, requestItemController);

export const adminDemandRoutes = Router();

adminDemandRoutes.use(requireAuth, requireRole("admin"));
adminDemandRoutes.get("/", listDemandController);
adminDemandRoutes.patch("/:id", resolveDemandController);
