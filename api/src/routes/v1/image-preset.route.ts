import { Router } from "express";

import { listImagePresetsController } from "../../controllers/image-preset.controller";

export const imagePresetRoutes = Router();

// Public: the app draws these tiles for anyone browsing, signed in or not.
imagePresetRoutes.get("/", listImagePresetsController);
