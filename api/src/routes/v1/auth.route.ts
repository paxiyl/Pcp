import { Router } from "express";

import {
  authProvidersController,
  currentUserController,
  googleSignInController,
  loginController,
  logoutController,
  registerController,
} from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authLimiter } from "../../middlewares/rateLimiter.middleware";

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, registerController);
authRoutes.post("/login", authLimiter, loginController);
// Rate limited like a password login: an ID token is still a credential.
authRoutes.post("/google", authLimiter, googleSignInController);
authRoutes.get("/providers", authProvidersController);
authRoutes.post("/logout", logoutController);
authRoutes.get("/me", requireAuth, currentUserController);
