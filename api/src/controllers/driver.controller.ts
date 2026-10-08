import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  claimDelivery,
  findDelivery,
  listMyDeliveries,
  listReadyDeliveries,
  markDelivered,
  markPickedUp,
  setOnline,
  todaySummary,
} from "../services/driver.service";
import {
  completeDeliverySchema,
  deliveryIdSchema,
  onlineSchema,
} from "../validators/driver.validator";

const currentDriver = (request: Request) => request.user as UserDocument;

export const getDriverHomeController = asyncHandler(
  async (request: Request, response: Response) => {
    const driver = currentDriver(request);
    const [summary, ready, active] = await Promise.all([
      todaySummary(driver),
      listReadyDeliveries(),
      listMyDeliveries(driver._id.toString()),
    ]);

    return response
      .status(HTTPSTATUS.OK)
      .json({ message: "Driver home", data: { active, ready, summary } });
  },
);

export const getDeliveryController = asyncHandler(async (request: Request, response: Response) => {
  const { orderId } = deliveryIdSchema.parse(request.params);
  const payload = await findDelivery(currentDriver(request)._id.toString(), orderId);

  return response.status(HTTPSTATUS.OK).json({ message: "Delivery", data: payload });
});

export const claimDeliveryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = deliveryIdSchema.parse(request.params);
    const payload = await claimDelivery(currentDriver(request), orderId);

    return response.status(HTTPSTATUS.OK).json({ message: "Delivery claimed", data: payload });
  },
);

export const pickUpDeliveryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = deliveryIdSchema.parse(request.params);
    const payload = await markPickedUp(currentDriver(request)._id.toString(), orderId);

    return response.status(HTTPSTATUS.OK).json({ message: "Picked up", data: payload });
  },
);

export const completeDeliveryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = deliveryIdSchema.parse(request.params);
    const { code } = completeDeliverySchema.parse(request.body);
    const payload = await markDelivered(currentDriver(request)._id.toString(), orderId, code);

    return response.status(HTTPSTATUS.OK).json({ message: "Delivered", data: payload });
  },
);

export const setOnlineController = asyncHandler(async (request: Request, response: Response) => {
  const { isOnline } = onlineSchema.parse(request.body);
  const value = await setOnline(currentDriver(request), isOnline);

  return response.status(HTTPSTATUS.OK).json({ message: "Updated", data: { isOnline: value } });
});
