import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  applyToBePartner,
  listApplications,
  myApplication,
  reviewApplication,
} from "../services/partner-application.service";
import {
  applicationIdSchema,
  applicationQuerySchema,
  applicationReviewSchema,
  partnerApplicationSchema,
} from "../validators/partner-application.validator";

const currentUser = (request: Request) => request.user as UserDocument;

export const applyController = asyncHandler(async (request: Request, response: Response) => {
  const input = partnerApplicationSchema.parse(request.body);
  const application = await applyToBePartner(currentUser(request), input);

  return response
    .status(HTTPSTATUS.CREATED)
    .json({ message: "Application received", data: { application } });
});

export const myApplicationController = asyncHandler(
  async (request: Request, response: Response) => {
    const application = await myApplication(currentUser(request));

    return response.status(HTTPSTATUS.OK).json({ message: "Application", data: { application } });
  },
);

export const listApplicationsController = asyncHandler(
  async (request: Request, response: Response) => {
    const { status } = applicationQuerySchema.parse(request.query);
    const applications = await listApplications(status);

    return response.status(HTTPSTATUS.OK).json({ message: "Applications", data: { applications } });
  },
);

export const reviewApplicationController = asyncHandler(
  async (request: Request, response: Response) => {
    const { applicationId } = applicationIdSchema.parse(request.params);
    const input = applicationReviewSchema.parse(request.body);
    const application = await reviewApplication(currentUser(request), applicationId, input);

    return response.status(HTTPSTATUS.OK).json({
      message: input.status === "approved" ? "Partner approved" : "Application rejected",
      data: { application },
    });
  },
);
