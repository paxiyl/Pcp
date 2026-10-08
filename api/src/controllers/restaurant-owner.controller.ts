import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { UserDocument } from "../models/user.model";
import {
  createOwnDish,
  deleteOwnDish,
  getOverview,
  listOwnDishes,
  setOpen,
  updateOwnDish,
} from "../services/restaurant-owner.service";
import {
  ownerDishesQuerySchema,
  ownerDishIdSchema,
  ownerDishSchema,
  ownerDishUpdateSchema,
  setRestaurantOpenSchema,
} from "../validators/restaurant-owner.validator";

const currentOwner = (request: Request) => request.user as UserDocument;

export const restaurantOverviewController = asyncHandler(
  async (request: Request, response: Response) => {
    const data = await getOverview(currentOwner(request));

    return response.status(HTTPSTATUS.OK).json({ message: "Overview", data });
  },
);

export const setRestaurantOpenController = asyncHandler(
  async (request: Request, response: Response) => {
    const { isOpen } = setRestaurantOpenSchema.parse(request.body);
    const restaurant = await setOpen(currentOwner(request), isOpen);

    return response
      .status(HTTPSTATUS.OK)
      .json({ message: isOpen ? "Kitchen open" : "Kitchen closed", data: { restaurant } });
  },
);

export const restaurantDishesController = asyncHandler(
  async (request: Request, response: Response) => {
    const { search } = ownerDishesQuerySchema.parse(request.query);
    const dishes = await listOwnDishes(currentOwner(request), search);

    return response.status(HTTPSTATUS.OK).json({ message: "Dishes", data: { dishes } });
  },
);

export const createRestaurantDishController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = ownerDishSchema.parse(request.body);
    const dish = await createOwnDish(currentOwner(request), input);

    return response.status(HTTPSTATUS.CREATED).json({ message: "Dish added", data: { dish } });
  },
);

export const updateRestaurantDishController = asyncHandler(
  async (request: Request, response: Response) => {
    const { dishId } = ownerDishIdSchema.parse(request.params);
    const input = ownerDishUpdateSchema.parse(request.body);
    const dish = await updateOwnDish(currentOwner(request), dishId, input);

    return response.status(HTTPSTATUS.OK).json({ message: "Dish updated", data: { dish } });
  },
);

export const deleteRestaurantDishController = asyncHandler(
  async (request: Request, response: Response) => {
    const { dishId } = ownerDishIdSchema.parse(request.params);

    await deleteOwnDish(currentOwner(request), dishId);

    return response.status(HTTPSTATUS.OK).json({ message: "Dish removed" });
  },
);
