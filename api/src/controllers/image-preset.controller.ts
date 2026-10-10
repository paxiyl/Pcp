import { Request, Response } from "express";

import { isCloudinaryConfigured } from "../config/cloudinary.config";
import { HTTPSTATUS } from "../config/http-status.config";
import { IMAGE_PRESETS } from "../config/image-presets";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";

/**
 * The preset catalogue, served rather than duplicated in each client.
 *
 * One list means a preset added here appears in the backoffice picker and draws
 * correctly in the app without shipping either of them again. The payload
 * carries only a glyph and two colours, which every client can draw with no
 * icon library and no shared package.
 *
 * `uploadsEnabled` rides along because the picker needs both answers at once:
 * whether a real photograph can be uploaded at all in this deployment, and what
 * to offer instead when it cannot. Letting the owner press Upload and meet an
 * error is the version of this that wastes their time.
 */
export const listImagePresetsController = asyncHandler(
  async (_request: Request, response: Response) =>
    response.status(HTTPSTATUS.OK).json({
      message: "Image presets",
      data: { presets: IMAGE_PRESETS, uploadsEnabled: isCloudinaryConfigured() },
    }),
);
