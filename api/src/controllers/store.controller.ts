import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createProduct,
  createProductCategory,
  createStore,
  deleteProduct,
  deleteProductCategory,
  deleteStore,
  findProductById,
  findStoreBySlug,
  listProductCategories,
  listProducts,
  listStores,
  updateProduct,
  updateProductCategory,
  updateStore,
} from "../services/store.service";
import {
  productCategorySchema,
  productCategoryUpdateSchema,
  productIdSchema,
  productQuerySchema,
  productSchema,
  productUpdateSchema,
  storeIdSchema,
  storeQuerySchema,
  storeSchema,
  storeSlugSchema,
  storeUpdateSchema,
} from "../validators/store.validator";

export const listStoresController = asyncHandler(async (request: Request, response: Response) => {
  const query = storeQuerySchema.parse(request.query);
  const stores = await listStores(query);

  return response.status(HTTPSTATUS.OK).json({ message: "Stores", data: { stores } });
});

export const getStoreController = asyncHandler(async (request: Request, response: Response) => {
  const { slug } = storeSlugSchema.parse(request.params);
  const { products, store } = await findStoreBySlug(slug);

  return response.status(HTTPSTATUS.OK).json({ message: "Store", data: { store, products } });
});

export const createStoreController = asyncHandler(async (request: Request, response: Response) => {
  const input = storeSchema.parse(request.body);
  const store = await createStore(input);

  return response.status(HTTPSTATUS.CREATED).json({ message: "Store created", data: { store } });
});

export const updateStoreController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = storeIdSchema.parse(request.params);
  const input = storeUpdateSchema.parse(request.body);
  const store = await updateStore(id, input);

  return response.status(HTTPSTATUS.OK).json({ message: "Store updated", data: { store } });
});

export const deleteStoreController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = storeIdSchema.parse(request.params);
  await deleteStore(id);

  return response.status(HTTPSTATUS.OK).json({ message: "Store removed" });
});

export const listProductsController = asyncHandler(async (request: Request, response: Response) => {
  const query = productQuerySchema.parse(request.query);
  const { page, pages, products, total } = await listProducts(query);

  return response
    .status(HTTPSTATUS.OK)
    .json({ message: "Products", data: { products, total, page, pages } });
});

export const getProductController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = productIdSchema.parse(request.params);
  const { product, store, variants } = await findProductById(id);

  return response
    .status(HTTPSTATUS.OK)
    .json({ message: "Product", data: { product, store, variants } });
});

export const createProductController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = storeIdSchema.parse(request.params);
    const input = productSchema.parse(request.body);
    const product = await createProduct(id, input);

    return response
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Product created", data: { product } });
  },
);

export const updateProductController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = productIdSchema.parse(request.params);
    const input = productUpdateSchema.parse(request.body);
    const product = await updateProduct(id, input);

    return response.status(HTTPSTATUS.OK).json({ message: "Product updated", data: { product } });
  },
);

export const deleteProductController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = productIdSchema.parse(request.params);
    await deleteProduct(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Product removed" });
  },
);

export const listProductCategoriesController = asyncHandler(
  async (_request: Request, response: Response) => {
    const categories = await listProductCategories();

    return response.status(HTTPSTATUS.OK).json({ message: "Categories", data: { categories } });
  },
);

export const createProductCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = productCategorySchema.parse(request.body);
    const category = await createProductCategory(input);

    return response
      .status(HTTPSTATUS.CREATED)
      .json({ message: "Category created", data: { category } });
  },
);

export const updateProductCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = storeIdSchema.parse(request.params);
    const input = productCategoryUpdateSchema.parse(request.body);
    const category = await updateProductCategory(id, input);

    return response.status(HTTPSTATUS.OK).json({ message: "Category updated", data: { category } });
  },
);

export const deleteProductCategoryController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = storeIdSchema.parse(request.params);
    await deleteProductCategory(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Category removed" });
  },
);
