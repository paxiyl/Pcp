import { Router } from "express";

import { searchController } from "../../controllers/search.controller";

export const searchRoutes = Router();

// Browsing is public, and so is searching it.
searchRoutes.get("/", searchController);
