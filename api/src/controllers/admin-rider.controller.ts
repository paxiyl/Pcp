import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { createRider, listRiders, updateRider } from "../services/admin-rider.service";
import {
  adminRiderQuerySchema,
  createRiderSchema,
  riderIdParamSchema,
  updateRiderSchema,
} from "../validators/admin-rider.validator";

export const listRidersController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = adminRiderQuerySchema.parse(request.query);
    const payload = await listRiders(query);

    return response.status(HTTPSTATUS.OK).json({ message: "Riders", data: payload });
  },
);

export const createRiderController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = createRiderSchema.parse(request.body);
    const rider = await createRider(input);

    return response.status(HTTPSTATUS.CREATED).json({
      message: "Rider added",
      data: { rider },
    });
  },
);

export const updateRiderController = asyncHandler(
  async (request: Request, response: Response) => {
    const { riderId } = riderIdParamSchema.parse(request.params);
    const input = updateRiderSchema.parse(request.body);
    const rider = await updateRider(riderId, input);

    return response.status(HTTPSTATUS.OK).json({
      message: "Rider updated",
      data: { rider },
    });
  },
);
