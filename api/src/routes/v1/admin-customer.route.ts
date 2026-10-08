import { Router } from "express";

import {
  listCustomersController,
  updateCustomerController,
} from "../../controllers/admin-customer.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

export const adminCustomerRoutes = Router();

adminCustomerRoutes.use(requireAuth, requireRole("admin"));

adminCustomerRoutes.get("/", listCustomersController);
adminCustomerRoutes.patch("/:customerId", updateCustomerController);
