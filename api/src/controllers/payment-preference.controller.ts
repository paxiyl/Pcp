import { Request, Response } from "express";
import { z } from "zod";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { PAYMENT_METHODS } from "../models/order.model";
import { UserDocument } from "../models/user.model";
import {
  getPaymentPreferences,
  setPreferredPaymentMethod,
} from "../services/payment-preference.service";

const bodySchema = z.object({ method: z.enum(PAYMENT_METHODS) });

const userId = (request: Request): string =>
  (request.user as UserDocument)._id.toString();

export const getPaymentPreferencesController = asyncHandler(
  async (request: Request, response: Response) => {
    const preferences = await getPaymentPreferences(userId(request));

    return response.status(HTTPSTATUS.OK).json({
      message: "Payment preferences",
      data: preferences,
    });
  },
);

export const setPaymentPreferenceController = asyncHandler(
  async (request: Request, response: Response) => {
    const { method } = bodySchema.parse(request.body);
    const preferences = await setPreferredPaymentMethod(userId(request), method);

    return response.status(HTTPSTATUS.OK).json({
      message: "Saved — checkout will open on this",
      data: preferences,
    });
  },
);
