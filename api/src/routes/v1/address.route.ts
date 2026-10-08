import { Router } from "express";

import {
  createAddressController,
  deleteAddressController,
  listAddressesController,
  setDefaultAddressController,
  updateAddressController,
} from "../../controllers/address.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

export const addressRoutes = Router();

addressRoutes.use(requireAuth);

addressRoutes.get("/", listAddressesController);
addressRoutes.post("/", createAddressController);
addressRoutes.patch("/:id", updateAddressController);
addressRoutes.patch("/:id/default", setDefaultAddressController);
addressRoutes.delete("/:id", deleteAddressController);
