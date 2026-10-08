import { v2 as cloudinary } from "cloudinary";

import { Env } from "./env.config";

/**
 * Cloudinary is optional at boot: the API runs fine without keys, and only the
 * code paths that actually upload (the seed script, admin uploads) require them.
 */
export const isCloudinaryConfigured = (): boolean =>
  Boolean(Env.CLOUDINARY_CLOUD_NAME && Env.CLOUDINARY_API_KEY && Env.CLOUDINARY_API_SECRET);

let configured = false;

const ensureConfigured = () => {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }

  if (configured) return;

  cloudinary.config({
    api_key: Env.CLOUDINARY_API_KEY,
    api_secret: Env.CLOUDINARY_API_SECRET,
    cloud_name: Env.CLOUDINARY_CLOUD_NAME,
    secure: true,
  });

  configured = true;
};

export type UploadedImage = {
  url: string;
  publicId: string;
};

/** Uploads a local file, overwriting the previous asset with the same public id. */
export const uploadImage = async (
  filePath: string,
  options: { folder: string; publicId: string },
): Promise<UploadedImage> => {
  ensureConfigured();

  const result = await cloudinary.uploader.upload(filePath, {
    folder: options.folder,
    overwrite: true,
    public_id: options.publicId,
    resource_type: "image",
  });

  return { publicId: result.public_id, url: result.secure_url };
};

/** Uploads bytes held in memory, as an admin upload arrives from the browser. */
export const uploadImageBuffer = async (
  buffer: Buffer,
  mimeType: string,
  options: { folder: string; publicId?: string },
): Promise<UploadedImage> => {
  ensureConfigured();

  const result = await cloudinary.uploader.upload(
    `data:${mimeType};base64,${buffer.toString("base64")}`,
    {
      folder: options.folder,
      overwrite: true,
      resource_type: "image",
      ...(options.publicId ? { public_id: options.publicId } : {}),
    },
  );

  return { publicId: result.public_id, url: result.secure_url };
};

export const deleteImage = async (publicId: string): Promise<void> => {
  ensureConfigured();

  await cloudinary.uploader.destroy(publicId);
};

export { cloudinary };
