import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  bannerState,
  createBanner,
  deleteBanner,
  listActiveBanners,
  listAllBanners,
  reorderBanners,
  updateBanner,
} from "../services/banner.service";
import {
  bannerIdSchema,
  bannerReorderSchema,
  bannerSchema,
  bannerUpdateSchema,
} from "../validators/banner.validator";

/** Public: only what is live right now, which is all the app should know. */
export const listActiveBannersController = asyncHandler(
  async (_request: Request, response: Response) => {
    const banners = await listActiveBanners();

    return response.status(HTTPSTATUS.OK).json({ message: "Banners", data: { banners } });
  },
);

export const listAdminBannersController = asyncHandler(
  async (_request: Request, response: Response) => {
    const banners = await listAllBanners();
    const states = banners.map((banner) => bannerState(banner));

    return response.status(HTTPSTATUS.OK).json({
      message: "Banners",
      data: {
        // The state is derived, so it ships alongside the row rather than
        // being recomputed with a different clock in the browser.
        banners: banners.map((banner, index) => ({
          ...banner.toJSON(),
          state: states[index],
        })),
        stats: {
          active: states.filter((state) => state === "active").length,
          scheduled: states.filter((state) => state === "scheduled").length,
          total: banners.length,
        },
      },
    });
  },
);

export const createBannerController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = bannerSchema.parse(request.body);
    const banner = await createBanner(input);

    return response.status(HTTPSTATUS.CREATED).json({
      message: "Banner created",
      data: { banner },
    });
  },
);

export const updateBannerController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = bannerIdSchema.parse(request.params);
    const input = bannerUpdateSchema.parse(request.body);
    const banner = await updateBanner(id, input);

    return response.status(HTTPSTATUS.OK).json({
      message: "Banner updated",
      data: { banner },
    });
  },
);

export const deleteBannerController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = bannerIdSchema.parse(request.params);
    await deleteBanner(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Banner removed" });
  },
);

export const reorderBannersController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = bannerReorderSchema.parse(request.body);
    await reorderBanners(input);

    return response.status(HTTPSTATUS.OK).json({ message: "Display order saved" });
  },
);
