import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { listAdminCategories } from "../services/admin-category.service";
import { reorderCategories } from "../services/category.service";
import { categoryReorderSchema } from "../validators/category.validator";

export const listAdminCategoriesController = asyncHandler(
  async (_request: Request, response: Response) => {
    const payload = await listAdminCategories();

    return response.status(HTTPSTATUS.OK).json({ message: "Categories", data: payload });
  },
);

export const reorderCategoriesController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = categoryReorderSchema.parse(request.body);
    await reorderCategories(input);

    return response.status(HTTPSTATUS.OK).json({ message: "Display order saved" });
  },
);
