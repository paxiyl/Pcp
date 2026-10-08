import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createStoreOwner,
  deactivateStoreOwner,
  listStoreOwners,
  updateStoreOwner,
} from "../services/admin-store-owner.service";
import {
  createStoreOwnerSchema,
  storeOwnerIdSchema,
  storeOwnerQuerySchema,
  updateStoreOwnerSchema,
} from "../validators/admin-store-owner.validator";

export const listStoreOwnersController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = storeOwnerQuerySchema.parse(request.query);
    const data = await listStoreOwners(query);

    return response.status(HTTPSTATUS.OK).json({ message: "Store owners", data });
  },
);

export const createStoreOwnerController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = createStoreOwnerSchema.parse(request.body);
    const owner = await createStoreOwner(input);

    return response
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Store owner created", data: { owner } });
  },
);

export const updateStoreOwnerController = asyncHandler(
  async (request: Request, response: Response) => {
    const { ownerId } = storeOwnerIdSchema.parse(request.params);
    const input = updateStoreOwnerSchema.parse(request.body);
    const owner = await updateStoreOwner(ownerId, input);

    return response.status(HTTPSTATUS.OK).json({ message: "Store owner updated", data: { owner } });
  },
);

export const deactivateStoreOwnerController = asyncHandler(
  async (request: Request, response: Response) => {
    const { ownerId } = storeOwnerIdSchema.parse(request.params);
    await deactivateStoreOwner(ownerId);

    return response.status(HTTPSTATUS.OK).json({ message: "Store owner deactivated" });
  },
);
