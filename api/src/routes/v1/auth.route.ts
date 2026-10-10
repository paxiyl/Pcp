import { Router } from "express";

import {
  authProvidersController,
  currentUserController,
  googleSignInController,
  registerPushTokenController,
  removePushTokenController,
  loginController,
  logoutController,
  registerController,
} from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth.middleware";
import {
  googleLimiter,
  loginLimiter,
  registerLimiter,
} from "../../middlewares/rateLimiter.middleware";

export const authRoutes = Router();

authRoutes.post("/register", registerLimiter, registerController);
authRoutes.post("/login", loginLimiter, loginController);
// An ID token is still a credential, so failures count — on its own budget.
authRoutes.post("/google", googleLimiter, googleSignInController);
authRoutes.get("/providers", authProvidersController);
authRoutes.post("/logout", logoutController);
authRoutes.get("/me", requireAuth, currentUserController);
authRoutes.post("/push-token", requireAuth, registerPushTokenController);
authRoutes.delete("/push-token", requireAuth, removePushTokenController);
