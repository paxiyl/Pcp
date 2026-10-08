import { Router } from "express";

import {
  createProductCategoryController,
  createProductController,
  createStoreController,
  deleteProductCategoryController,
  deleteProductController,
  deleteStoreController,
  getProductController,
  getStoreController,
  listProductCategoriesController,
  listProductsController,
  listStoresController,
  updateProductCategoryController,
  updateProductController,
  updateStoreController,
} from "../../controllers/store.controller";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware";

const adminOnly = [requireAuth, requireRole("admin")] as const;

export const storeRoutes = Router();

// Browsing is public; only the backoffice writes. Same policy as restaurants.
storeRoutes.get("/", listStoresController);
storeRoutes.get("/:slug", getStoreController);

storeRoutes.post("/", ...adminOnly, createStoreController);
storeRoutes.patch("/:id", ...adminOnly, updateStoreController);
storeRoutes.delete("/:id", ...adminOnly, deleteStoreController);

// A product is created against the store that stocks it.
storeRoutes.post("/:id/products", ...adminOnly, createProductController);

export const productRoutes = Router();

productRoutes.get("/", listProductsController);
productRoutes.get("/:id", getProductController);

productRoutes.patch("/:id", ...adminOnly, updateProductController);
productRoutes.delete("/:id", ...adminOnly, deleteProductController);

export const productCategoryRoutes = Router();

productCategoryRoutes.get("/", listProductCategoriesController);

productCategoryRoutes.post("/", ...adminOnly, createProductCategoryController);
productCategoryRoutes.patch("/:id", ...adminOnly, updateProductCategoryController);
productCategoryRoutes.delete("/:id", ...adminOnly, deleteProductCategoryController);
