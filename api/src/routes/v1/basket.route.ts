import { Router } from "express";

import {
  addBasketItemController,
  addBasketProductController,
  clearBasketController,
  getBasketController,
  setBasketItemQuantityController,
  updateBasketController,
} from "../../controllers/basket.controller";
import { requireAuth } from "../../middlewares/auth.middleware";

export const basketRoutes = Router();

// A basket belongs to one signed-in customer.
basketRoutes.use(requireAuth);

basketRoutes.get("/", getBasketController);
basketRoutes.patch("/", updateBasketController);
basketRoutes.delete("/", clearBasketController);

// Two entry points rather than one polymorphic body: a dish carries options and a
// note, a product carries neither, and collapsing them would mean a schema where
// half the fields are meaningless on every call.
basketRoutes.post("/items", addBasketItemController);
basketRoutes.post("/products", addBasketProductController);
basketRoutes.patch("/items/:itemId", setBasketItemQuantityController);
