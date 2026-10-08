import { Request, Response } from "express";

import { HTTPSTATUS } from "../config/http-status.config";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  findRestaurantWithDishes,
  listRestaurants,
} from "../services/admin-restaurant.service";
import { adminRestaurantQuerySchema } from "../validators/admin-restaurant.validator";
import { restaurantIdSchema } from "../validators/restaurant.validator";

export const listAdminRestaurantsController = asyncHandler(
  async (request: Request, response: Response) => {
    const query = adminRestaurantQuerySchema.parse(request.query);
    const payload = await listRestaurants(query);

    return response.status(HTTPSTATUS.OK).json({ message: "Restaurants", data: payload });
  },
);

export const getAdminRestaurantController = asyncHandler(
  async (request: Request, response: Response) => {
    const { id } = restaurantIdSchema.parse(request.params);
    const payload = await findRestaurantWithDishes(id);

    return response.status(HTTPSTATUS.OK).json({ message: "Restaurant", data: payload });
  },
);
