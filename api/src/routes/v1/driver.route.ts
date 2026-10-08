import { Router } from "express";

import {
  claimDeliveryController,
  completeDeliveryController,
  getDeliveryController,
  getDriverHomeController,
  pickUpDeliveryController,
  setOnlineController,
} from "../../controllers/driver.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const driverRoutes = Router();

// Every route here is rider-only; a customer token must never reach the queue.
driverRoutes.use(requireAuth, requireRole("driver"));

driverRoutes.get("/home", getDriverHomeController);
driverRoutes.patch("/online", setOnlineController);

driverRoutes.get("/deliveries/:orderId", getDeliveryController);
driverRoutes.post("/deliveries/:orderId/claim", claimDeliveryController);
driverRoutes.post("/deliveries/:orderId/pick-up", pickUpDeliveryController);
driverRoutes.post("/deliveries/:orderId/complete", completeDeliveryController);
