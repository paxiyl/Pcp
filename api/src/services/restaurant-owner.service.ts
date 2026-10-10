import mongoose from "mongoose";

import { DishDocument, DishModel } from "../models/dish.model";
import { OrderDocument, OrderModel, OrderStatus } from "../models/order.model";
import { RestaurantDocument, RestaurantModel } from "../models/restaurant.model";
import { UserDocument } from "../models/user.model";
import { BadRequestException, ForbiddenException, NotFoundException } from "../utils/app-error";
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
      "This account is not linked to a kitchen yet. Ask Raket support to connect it.",
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

/**
 * The kitchen's own orders.
 *
 * Scoped to the restaurant on the account, exactly as the dish queries are: an
 * id in a URL is a lookup key, never a grant.
 */
export const listOwnOrders = async (
  user: UserDocument,
  status?: OrderStatus,
): Promise<OrderDocument[]> => {
  const restaurant = await resolveOwnRestaurant(user);

  return OrderModel.find({
    restaurantId: restaurant._id,
    ...(status ? { status } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .exec();
};

/**
 * The only two transitions a kitchen owns, and for the same reason the shop
 * has only these: dispatch and delivery belong to the rider, payment belongs
 * to the gateway. A kitchen that could mark an order delivered could close out
 * food that never left the counter.
 */
const KITCHEN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["preparing"],
  preparing: ["ready"],
};

export const advanceOwnOrder = async (
  user: UserDocument,
  orderId: string,
  next: OrderStatus,
): Promise<OrderDocument> => {
  const restaurant = await resolveOwnRestaurant(user);

  const order = await OrderModel.findOne({
    _id: orderId,
    restaurantId: restaurant._id,
  }).exec();

  // Another kitchen's order reads as "not found" rather than "forbidden",
  // which would confirm it exists.
  if (!order) throw new NotFoundException("Order not found");

  const allowed = KITCHEN_TRANSITIONS[order.status as OrderStatus] ?? [];

  if (!allowed.includes(next)) {
    throw new BadRequestException(`You cannot move an order from ${order.status} to ${next}`);
  }

  order.status = next;
  order.statusHistory.push({ at: new Date(), status: next } as never);
  await order.save();

  return order;
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
