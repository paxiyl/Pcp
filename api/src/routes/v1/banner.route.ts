import { Router } from "express";

import {
  createBannerController,
  deleteBannerController,
  listActiveBannersController,
  listAdminBannersController,
  reorderBannersController,
  updateBannerController,
} from "../../controllers/banner.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const bannerRoutes = Router();
export const adminBannerRoutes = Router();

// What the customer app reads: live banners only, no account needed.
bannerRoutes.get("/active", listActiveBannersController);

adminBannerRoutes.use(requireAuth, requireRole("admin"));

adminBannerRoutes.get("/", listAdminBannersController);
adminBannerRoutes.post("/", createBannerController);
adminBannerRoutes.patch("/reorder", reorderBannersController);
adminBannerRoutes.patch("/:id", updateBannerController);
adminBannerRoutes.delete("/:id", deleteBannerController);
