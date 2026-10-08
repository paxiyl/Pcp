import { Request, Response } from "express";

import { isCloudinaryConfigured, uploadImageBuffer } from "../config/cloudinary.config";
import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { BadRequestException } from "../utils/app-error";

/** Only these folders may be written to, so a caller cannot pick any path. */
const FOLDERS: Record<string, string> = {
  banners: "chowly/banners",
  categories: "chowly/categories",
  dishes: "chowly/dishes",
  restaurants: "chowly/restaurants",
};

export const uploadImageController = asyncHandler(async (request: Request, response: Response) => {
  if (!isCloudinaryConfigured()) {
    throw new BadRequestException("Image hosting is not configured");
  }

  const file = request.file;

  if (!file) throw new BadRequestException("Choose an image to upload");

  const folder = FOLDERS[String(request.body.folder ?? "restaurants")];

  if (!folder) throw new BadRequestException("Unknown upload folder");

  const uploaded = await uploadImageBuffer(file.buffer, file.mimetype, { folder });

  return response.status(HTTPSTATUS.CREATED).json({ message: "Image uploaded", data: uploaded });
});
