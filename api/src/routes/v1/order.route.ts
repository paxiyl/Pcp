import { Router } from "express";

import {
  createOrderController,
  getOrderController,
  listOrdersController,
  reorderController,
  syncOrderController,
  verifyPaymentController,
} from "../../controllers/order.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

export const orderRoutes = Router();

// Orders always belong to the signed-in customer.
orderRoutes.use(requireAuth);

orderRoutes.post("/", createOrderController);
orderRoutes.get("/", listOrdersController);
orderRoutes.get("/:orderId", getOrderController);
orderRoutes.post("/:orderId/verify-payment", verifyPaymentController);
orderRoutes.post("/:orderId/sync", syncOrderController);
orderRoutes.post("/:orderId/reorder", reorderController);
