import { Router } from "express";

import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "../../controllers/category.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const categoryRoutes = Router();

// The catalogue is public: browsing does not require an account.
categoryRoutes.get("/", listCategoriesController);

categoryRoutes.post("/", requireAuth, requireRole("admin"), createCategoryController);
categoryRoutes.patch("/:id", requireAuth, requireRole("admin"), updateCategoryController);
categoryRoutes.delete("/:id", requireAuth, requireRole("admin"), deleteCategoryController);
