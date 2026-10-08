import { Router } from "express";

import {
  currentUserController,
  loginController,
  logoutController,
  registerController,
} from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authLimiter } from "../../middlewares/rateLimiter.middleware";

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, registerController);
authRoutes.post("/login", authLimiter, loginController);
authRoutes.post("/logout", logoutController);
authRoutes.get("/me", requireAuth, currentUserController);
