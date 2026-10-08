import { Router } from "express";

import {
  getOrderController,
  listOrdersController,
  releaseRiderController,
  refundOrderController,
  updateOrderStatusController,
} from "../../controllers/admin-order.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminOrderRoutes = Router();

adminOrderRoutes.use(requireAuth, requireRole("admin"));

adminOrderRoutes.get("/", listOrdersController);
adminOrderRoutes.get("/:orderId", getOrderController);
adminOrderRoutes.patch("/:orderId/status", updateOrderStatusController);
adminOrderRoutes.post("/:orderId/refund", refundOrderController);
adminOrderRoutes.post("/:orderId/release-rider", releaseRiderController);
