import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createCategory,
  deleteCategory,
  listActiveCategories,
  listAllCategories,
  updateCategory,
} from "../services/category.service";
import {
  categoryIdSchema,
  categorySchema,
  categoryUpdateSchema,
} from "../validators/category.validator";

export const listCategoriesController = asyncHandler(
  async (request: Request, response: Response) => {
    // Admin tooling needs the inactive ones too; the app only ever sees active.
    const includeInactive = request.query.includeInactive === "true";
    const categories = includeInactive ? await listAllCategories() : await listActiveCategories();

    return response.status(HTTPSTATUS.OK).json({
      message: "Categories",
      data: { categories },
    });
  },
);

export const createCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = categorySchema.parse(request.body);
    const category = await createCategory(input);

    return response.status(HTTPSTATUS.CREATED).json({
      message: "Category created",
      data: { category },
    });
  },
);

export const updateCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = categoryIdSchema.parse(request.params);
    const input = categoryUpdateSchema.parse(request.body);
    const category = await updateCategory(id, input);

    return response.status(HTTPSTATUS.OK).json({
      message: "Category updated",
      data: { category },
    });
  },
);

export const deleteCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = categoryIdSchema.parse(request.params);
    await deleteCategory(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Category removed" });
  },
);
