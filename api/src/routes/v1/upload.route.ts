import { Router } from "express";
import multer from "multer";

import { uploadImageController } from "../../controllers/upload.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

/** Kept in memory and streamed straight to Cloudinary; nothing touches disk. */
const upload = multer({
  fileFilter: (_request, file, callback) => {
    callback(null, /^image\/(png|jpe?g|webp|avif)$/.test(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
  storage: multer.memoryStorage(),
});

export const uploadRoutes = Router();

uploadRoutes.use(requireAuth, requireRole("admin"));

uploadRoutes.post("/image", upload.single("file"), uploadImageController);
