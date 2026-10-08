import mongoose from "mongoose";

import { DishDocument, DishModel } from "../models/dish.model";
import { OrderDocument, OrderModel, OrderStatus } from "../models/order.model";
import { RestaurantDocument, RestaurantModel } from "../models/restaurant.model";
import { UserDocument } from "../models/user.model";
import { ForbiddenException, NotFoundException } from "../utils/app-error";
import {
  OwnerDishInput,
  OwnerDishUpdateInput,
} from "../validators/restaurant-owner.validator";
import { createDish, deleteDish, updateDish } from "./restaurant.service";

/**
 * Everything a restaurant can do, scoped to its own kitchen.
 *
 * The counterpart of store-owner.service, and it follows the same rule: every
 * query is filtered by the restaurant attached to the signed-in account, and
 * nothing takes a restaurantId from the client. An id in a URL is a lookup
 * key, never a grant.
 */

/** The restaurant this account runs, or a clear refusal. */
export const resolveOwnRestaurant = async (user: UserDocument): Promise<RestaurantDocument> => {
  if (!user.restaurantId) {
    throw new ForbiddenException(
      "This account is not linked to a restaurant yet. Ask OnlineMall support to connect it.",
    );
  }

  const restaurant = await RestaurantModel.findById(user.restaurantId).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  return restaurant;
};

/** Statuses a kitchen still has work to do on. */
const OPEN_STATUSES: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery"];

export type RestaurantOwnerOverview = {
  restaurant: RestaurantDocument;
  openOrders: OrderDocument[];
  today: { orders: number; revenue: number };
  unavailable: number;
};

export const getOverview = async (user: UserDocument): Promise<RestaurantOwnerOverview> => {
  const restaurant = await resolveOwnRestaurant(user);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // `sanitizeFilter` is on globally, so server-authored operators have to be
  // marked trusted or Mongoose casts them to literals and matches nothing.
  const [openOrders, todayOrders, unavailable] = await Promise.all([
    OrderModel.find({
      restaurantId: restaurant._id,
      status: mongoose.trusted({ $in: OPEN_STATUSES }),
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec(),
    OrderModel.find({
      createdAt: mongoose.trusted({ $gte: startOfDay }),
      restaurantId: restaurant._id,
      // Cancelled and unpaid orders are not takings.
      status: mongoose.trusted({ $nin: ["cancelled", "payment_failed", "pending_payment"] }),
    })
      .select("total")
      .exec(),
    DishModel.countDocuments({ isAvailable: false, restaurantId: restaurant._id }).exec(),
  ]);

  return {
    openOrders,
    restaurant,
    today: {
      orders: todayOrders.length,
      revenue: todayOrders.reduce((total, order) => total + order.total, 0),
    },
    unavailable,
  };
};

export const listOwnDishes = async (
  user: UserDocument,
  search?: string,
): Promise<DishDocument[]> => {
  const restaurant = await resolveOwnRestaurant(user);

  const filter: Record<string, unknown> = { restaurantId: restaurant._id };

  if (search) {
    filter.name = mongoose.trusted({
      $options: "i",
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    });
  }

  return DishModel.find(filter).sort({ section: 1, sortOrder: 1, name: 1 }).limit(300).exec();
};

export const createOwnDish = async (
  user: UserDocument,
  input: OwnerDishInput,
): Promise<DishDocument> => {
  const restaurant = await resolveOwnRestaurant(user);

  return createDish(restaurant._id.toString(), input);
};

/** Resolves a dish only if it belongs to this owner's restaurant. */
const resolveOwnDish = async (user: UserDocument, dishId: string): Promise<DishDocument> => {
  const restaurant = await resolveOwnRestaurant(user);
  const dish = await DishModel.findOne({ _id: dishId, restaurantId: restaurant._id }).exec();

  if (!dish) throw new NotFoundException("Dish not found");

  return dish;
};

export const updateOwnDish = async (
  user: UserDocument,
  dishId: string,
  input: OwnerDishUpdateInput,
): Promise<DishDocument> => {
  const dish = await resolveOwnDish(user, dishId);

  return updateDish(dish._id.toString(), input);
};

export const deleteOwnDish = async (user: UserDocument, dishId: string): Promise<void> => {
  const dish = await resolveOwnDish(user, dishId);

  await deleteDish(dish._id.toString());
};

/** Open and closed is the kitchen's own call; being listed at all is the admin's. */
export const setOpen = async (
  user: UserDocument,
  isOpen: boolean,
): Promise<RestaurantDocument> => {
  const restaurant = await resolveOwnRestaurant(user);

  restaurant.isOpen = isOpen;
  await restaurant.save();

  return restaurant;
};
