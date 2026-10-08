import mongoose from "mongoose";

import { DishModel } from "../models/dish.model";
import { OrderModel } from "../models/order.model";
import { RestaurantModel } from "../models/restaurant.model";
import { AdminRestaurantDetailStats, AdminRestaurantList, AdminRestaurantRow, AdminRestaurantStats } from "../types/admin-restaurant.types";
import { NotFoundException } from "../utils/app-error";
import { AdminRestaurantQuery } from "../validators/admin-restaurant.validator";
import { getSettings } from "./settings.service";

/** Orders that actually reached a kitchen; the rest never counted as trade. */
const COUNTED_STATUSES = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const startOfUtcDay = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const buildMatch = (query: AdminRestaurantQuery) => {
  const match: Record<string, unknown> = {};

  if (query.status === "active") match.isActive = true;
  if (query.status === "inactive") match.isActive = false;
  if (query.cuisine) match.cuisines = query.cuisine;

  if (query.search) {
    const pattern = mongoose.trusted({ $options: "i", $regex: escapeRegex(query.search) });

    match.$or = [{ name: pattern }, { address: pattern }];
  }

  return match;
};

/**
 * The list, its counts and today's order volume in one pass. Today's orders come
 * from a $lookup rather than a second round trip per restaurant.
 */
export const listRestaurants = async (
  query: AdminRestaurantQuery,
): Promise<AdminRestaurantList> => {
  const match = buildMatch(query);
  const skip = (query.page - 1) * query.limit;
  const today = startOfUtcDay();

  const [result] = await RestaurantModel.aggregate<{
    rows: AdminRestaurantRow[];
    count: { total: number }[];
  }>([
    { $match: match },
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $facet: {
        count: [{ $count: "total" }],
        rows: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $lookup: {
              as: "todayOrders",
              from: "orders",
              let: { restaurantId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$restaurantId", "$$restaurantId"] },
                        { $gte: ["$createdAt", today] },
                        { $in: ["$status", COUNTED_STATUSES] },
                      ],
                    },
                  },
                },
                { $count: "count" },
              ],
            },
          },
          {
            $project: {
              address: 1,
              closesAt: 1,
              commissionRate: 1,
              cuisines: 1,
              deliveryFee: 1,
              description: 1,
              freeDeliveryThreshold: 1,
              imageUrl: 1,
              isActive: 1,
              isOpen: 1,
              location: 1,
              minOrder: 1,
              name: 1,
              ordersToday: { $ifNull: [{ $first: "$todayOrders.count" }, 0] },
              prepTimeMaxMinutes: 1,
              prepTimeMinMinutes: 1,
              rating: 1,
              ratingCount: 1,
              slug: 1,
            },
          },
        ],
      },
    },
  ]);

  const [stats] = await RestaurantModel.aggregate<AdminRestaurantStats>([
    {
      $group: {
        _id: null,
        active: { $sum: { $cond: ["$isActive", 1, 0] } },
        inactive: { $sum: { $cond: ["$isActive", 0, 1] } },
        total: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const cuisines = await RestaurantModel.distinct("cuisines").exec();
  const settings = await getSettings();
  const total = result?.count[0]?.total ?? 0;

  return {
    cuisines: cuisines.filter(Boolean).sort(),
    defaultCommissionRate: settings.restaurantCommissionRate,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    restaurants: result?.rows ?? [],
    stats: stats ?? { active: 0, inactive: 0, total: 0 },
    total,
  };
};

/**
 * The backoffice view of one restaurant: its profile, today's trade and every
 * dish, including the unavailable ones the customer app hides.
 */
export const findRestaurantWithDishes = async (restaurantId: string) => {
  const restaurant = await RestaurantModel.findById(restaurantId).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  const dishes = await DishModel.find({ restaurantId })
    .sort({ section: 1, sortOrder: 1, name: 1 })
    .exec();

  // The same UTC window and the same statuses as the dashboard, so one
  // restaurant's "today" can never disagree with the platform-wide figure.
  const [today] = await OrderModel.aggregate<{ orders: number; revenue: number }>([
    {
      $match: {
        createdAt: mongoose.trusted({ $gte: startOfUtcDay() }),
        restaurantId: restaurant._id,
        status: mongoose.trusted({ $in: COUNTED_STATUSES }),
      },
    },
    { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: "$total" } } },
  ]);

  const settings = await getSettings();

  const stats: AdminRestaurantDetailStats = {
    activeDishes: dishes.filter((dish) => dish.isAvailable).length,
    ordersToday: today?.orders ?? 0,
    revenueToday: today?.revenue ?? 0,
  };

  return {
    defaultCommissionRate: settings.restaurantCommissionRate,
    dishes,
    restaurant,
    // Whatever sections this menu actually uses, for the filter and the form.
    sections: [...new Set(dishes.map((dish) => dish.section))].sort(),
    stats,
  };
};
