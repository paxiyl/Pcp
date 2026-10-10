import { Router } from "express";

import {
  getPaymentPreferencesController,
  setPaymentPreferenceController,
} from "../../controllers/payment-preference.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

export const paymentMethodRoutes = Router();

// Always the signed-in customer's own preference. There is no path here that
// takes a user id, so one account can never read or set another's.
paymentMethodRoutes.use(requireAuth);
paymentMethodRoutes.get("/", getPaymentPreferencesController);
paymentMethodRoutes.patch("/", setPaymentPreferenceController);
