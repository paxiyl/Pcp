import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import { getSettings, updateSettings } from "../services/settings.service";
import { settingsSchema } from "../validators/settings.validator";

export const getSettingsController = asyncHandler(async (_request: Request, response: Response) => {
  const settings = await getSettings();

  return response.status(HTTPSTATUS.OK).json({ message: "Settings", data: { settings } });
});

export const updateSettingsController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = settingsSchema.parse(request.body);
    const admin = request.user as UserDocument;
    const settings = await updateSettings(admin._id.toString(), input);

    return response.status(HTTPSTATUS.OK).json({ message: "Settings updated", data: { settings } });
  },
);
