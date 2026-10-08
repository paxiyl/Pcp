import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createDish,
  createRestaurant,
  deleteDish,
  deleteRestaurant,
  findDishById,
  findRestaurantBySlug,
  listRestaurants,
  updateDish,
  updateRestaurant,
} from "../services/restaurant.service";
import {
  dishIdSchema,
  dishSchema,
  dishUpdateSchema,
  restaurantIdSchema,
  restaurantQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
  restaurantSlugSchema,
} from "../validators/restaurant.validator";

export const listRestaurantsController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = restaurantQuerySchema.parse(request.query);
    const restaurants = await listRestaurants(query);

    return response.status(HTTPSTATUS.OK).json({
      message: "Restaurants",
      data: { restaurants },
    });
  },
);

export const getRestaurantController = asyncHandler(
  async (request: Request, response: Response) => {
    const { slug } = restaurantSlugSchema.parse(request.params);
    const { dishes, restaurant } = await findRestaurantBySlug(slug);

    return response.status(HTTPSTATUS.OK).json({
      message: "Restaurant",
      data: { restaurant, dishes },
    });
  },
);

export const createRestaurantController = asyncHandler(
  async (request: Request, response: Response) => {
    const input = restaurantSchema.parse(request.body);
    const restaurant = await createRestaurant(input);

    return response.status(HTTPSTATUS.CREATED).json({
      message: "Restaurant created",
      data: { restaurant },
    });
  },
);

export const updateRestaurantController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = restaurantIdSchema.parse(request.params);
    const input = restaurantUpdateSchema.parse(request.body);
    const restaurant = await updateRestaurant(id, input);

    return response.status(HTTPSTATUS.OK).json({
      message: "Restaurant updated",
      data: { restaurant },
    });
  },
);

export const deleteRestaurantController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = restaurantIdSchema.parse(request.params);
    await deleteRestaurant(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Restaurant removed" });
  },
);

export const getDishController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = dishIdSchema.parse(request.params);
  const { dish, restaurant } = await findDishById(id);

  return response.status(HTTPSTATUS.OK).json({
    message: "Dish",
    data: { dish, restaurant },
  });
});

export const createDishController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = restaurantIdSchema.parse(request.params);
  const input = dishSchema.parse(request.body);
  const dish = await createDish(id, input);

  return response.status(HTTPSTATUS.CREATED).json({
    message: "Dish created",
    data: { dish },
  });
});

export const updateDishController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = dishIdSchema.parse(request.params);
  const input = dishUpdateSchema.parse(request.body);
  const dish = await updateDish(id, input);

  return response.status(HTTPSTATUS.OK).json({
    message: "Dish updated",
    data: { dish },
  });
});

export const deleteDishController = asyncHandler(async (request: Request, response: Response) => {
  const { id } = dishIdSchema.parse(request.params);
  await deleteDish(id);

  return response.status(HTTPSTATUS.OK).json({ message: "Dish removed" });
});
