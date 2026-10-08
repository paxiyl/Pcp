import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  addItem,
  addProduct,
  clearBasket,
  getBasket,
  setItemQuantity,
  updateSettings,
} from "../services/basket.service";
import {
  addBasketItemSchema,
  addBasketProductSchema,
  basketItemIdSchema,
  basketSettingsSchema,
  itemQuantitySchema,
} from "../validators/basket.validator";

const currentUserId = (request: Request) => (request.user as UserDocument)._id.toString();

export const getBasketController = asyncHandler(async (request: Request, response: Response) => {
  const payload = await getBasket(currentUserId(request));

  return response.status(HTTPSTATUS.OK).json({ message: "Basket", data: payload });
});

export const addBasketItemController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = addBasketItemSchema.parse(request.body);
    const payload = await addItem(currentUserId(request), input);

    return response.status(HTTPSTATUS.CREATED).json({ message: "Item added", data: payload });
  },
);

export const addBasketProductController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = addBasketProductSchema.parse(request.body);
    const payload = await addProduct(currentUserId(request), input);

    return response.status(HTTPSTATUS.CREATED).json({ message: "Item added", data: payload });
  },
);

export const setBasketItemQuantityController = asyncHandler(
  async (request: Request, response: Response) => {
    const { itemId } = basketItemIdSchema.parse(request.params);
    const { quantity } = itemQuantitySchema.parse(request.body);
    const payload = await setItemQuantity(currentUserId(request), itemId, quantity);

    return response.status(HTTPSTATUS.OK).json({ message: "Basket updated", data: payload });
  },
);

export const updateBasketController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = basketSettingsSchema.parse(request.body);
    const payload = await updateSettings(currentUserId(request), input);

    return response.status(HTTPSTATUS.OK).json({ message: "Basket updated", data: payload });
  },
);

export const clearBasketController = asyncHandler(async (request: Request, response: Response) => {
  const payload = await clearBasket(currentUserId(request));

  return response.status(HTTPSTATUS.OK).json({ message: "Basket cleared", data: payload });
});
