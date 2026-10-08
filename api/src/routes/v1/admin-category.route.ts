import { Router } from "express";

import {
  listAdminCategoriesController,
  reorderCategoriesController,
} from "../../controllers/admin-category.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminCategoryRoutes = Router();

adminCategoryRoutes.use(requireAuth, requireRole("admin"));

// Create, update and delete stay on /categories, which is already admin-only;
// this is the backoffice read plus the one write the list owns.
adminCategoryRoutes.get("/", listAdminCategoriesController);
adminCategoryRoutes.patch("/reorder", reorderCategoriesController);
