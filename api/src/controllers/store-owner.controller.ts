import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  advanceOrder,
  getOverview,
  listOrders,
  listProducts,
  setOpen,
  updateStock,
} from "../services/store-owner.service";
import {
  advanceOrderSchema,
  ownerOrderIdSchema,
  ownerOrdersQuerySchema,
  ownerProductIdSchema,
  ownerProductsQuerySchema,
  setOpenSchema,
  updateStockSchema,
} from "../validators/store-owner.validator";

/** The signed-in shopkeeper. Every query below is scoped to their own store. */
const currentOwner = (request: Request) => request.user as UserDocument;

export const storeOverviewController = asyncHandler(
  async (request: Request, response: Response) => {
    const data = await getOverview(currentOwner(request));

    return response.status(HTTPSTATUS.OK).json({ message: "Overview", data });
  },
);

export const storeOrdersController = asyncHandler(async (request: Request, response: Response) => {
  const { status } = ownerOrdersQuerySchema.parse(request.query);
  const orders = await listOrders(currentOwner(request), status);

  return response.status(HTTPSTATUS.OK).json({ message: "Orders", data: { orders } });
});

export const advanceStoreOrderController = asyncHandler(
  async (request: Request, response: Response) => {
    const { orderId } = ownerOrderIdSchema.parse(request.params);
    const { status } = advanceOrderSchema.parse(request.body);
    const order = await advanceOrder(currentOwner(request), orderId, status);

    return response.status(HTTPSTATUS.OK).json({ message: "Order updated", data: { order } });
  },
);

export const storeProductsController = asyncHandler(
  async (request: Request, response: Response) => {
    const { search } = ownerProductsQuerySchema.parse(request.query);
    const products = await listProducts(currentOwner(request), search);

    return response.status(HTTPSTATUS.OK).json({ message: "Products", data: { products } });
  },
);

export const updateStoreStockController = asyncHandler(
  async (request: Request, response: Response) => {
    const { productId } = ownerProductIdSchema.parse(request.params);
    const input = updateStockSchema.parse(request.body);
    const product = await updateStock(currentOwner(request), productId, input);

    return response.status(HTTPSTATUS.OK).json({ message: "Stock updated", data: { product } });
  },
);

export const setStoreOpenController = asyncHandler(
  async (request: Request, response: Response) => {
    const { isOpen } = setOpenSchema.parse(request.body);
    const store = await setOpen(currentOwner(request), isOpen);

    return response.status(HTTPSTATUS.OK).json({ message: "Store updated", data: { store } });
  },
);
