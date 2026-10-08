import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { getOverview } from "../services/analytics.service";
import { overviewSchema } from "../validators/analytics.validator";

export const overviewController = asyncHandler(async (request: Request, response: Response) => {
  const { days } = overviewSchema.parse(request.query);
  const payload = await getOverview(days);

  return response.status(HTTPSTATUS.OK).json({ message: "Overview", data: payload });
});
