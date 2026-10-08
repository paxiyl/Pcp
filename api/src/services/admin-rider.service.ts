import mongoose from "mongoose";

import { OrderModel } from "../models/order.model";
import { DriverStatus, UserModel } from "../models/user.model";
import { AdminRiderList, AdminRiderRow, AdminRiderStats } from "../types/admin-rider.types";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  AdminRiderQuery,
  CreateRiderInput,
  UpdateRiderInput,
} from "../validators/admin-rider.validator";

/** A rider is busy while holding an order the kitchen has released to them. */
const ON_DELIVERY_STATUSES = ["ready", "out_for_delivery"];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const startOfUtcDay = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const buildMatch = (query: AdminRiderQuery) => {
  const match: Record<string, unknown> = { role: "driver" };

  if (query.verification) match.driverStatus = query.verification;

  if (query.search) {
    const pattern = mongoose.trusted({ $options: "i", $regex: escapeRegex(query.search) });

    match.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }

  return match;
};

/**
 * Every rider with the delivery figures that make the row worth reading. The
 * counts come from a $lookup over orders rather than a query per rider, and
 * "on delivery" is derived from live orders instead of a flag that can drift.
 */
export const listRiders = async (query: AdminRiderQuery): Promise<AdminRiderList> => {
  const match = buildMatch(query);
  const skip = (query.page - 1) * query.limit;

  const [result] = await UserModel.aggregate<{
    rows: AdminRiderRow[];
    count: { total: number }[];
  }>([
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        count: [{ $count: "total" }],
        rows: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $lookup: {
              as: "work",
              from: "orders",
              let: { driverId: "$_id" },
              pipeline: [
                { $match: { $expr: { $eq: ["$driver.driverId", "$$driverId"] } } },
                {
                  $group: {
                    _id: null,
                    activeDeliveries: {
                      $sum: { $cond: [{ $in: ["$status", ON_DELIVERY_STATUSES] }, 1, 0] },
                    },
                    deliveries: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
                    earnings: {
                      $sum: {
                        $cond: [
                          { $eq: ["$status", "delivered"] },
                          { $ifNull: ["$driverPayout.total", 0] },
                          0,
                        ],
                      },
                    },
                    lastDeliveryAt: { $max: "$updatedAt" },
                  },
                },
              ],
            },
          },
          {
            $project: {
              activeDeliveries: { $ifNull: [{ $first: "$work.activeDeliveries" }, 0] },
              createdAt: 1,
              deliveries: { $ifNull: [{ $first: "$work.deliveries" }, 0] },
              driverStatus: { $ifNull: ["$driverStatus", "pending"] },
              earnings: { $ifNull: [{ $first: "$work.earnings" }, 0] },
              email: 1,
              isActive: 1,
              isOnline: 1,
              lastDeliveryAt: { $first: "$work.lastDeliveryAt" },
              name: 1,
              phone: 1,
              rating: 1,
              ratingCount: 1,
            },
          },
        ],
      },
    },
  ]);

  const [counts] = await UserModel.aggregate<Omit<AdminRiderStats, "earningsToday">>([
    { $match: { role: "driver" } },
    {
      $group: {
        _id: null,
        online: { $sum: { $cond: ["$isOnline", 1, 0] } },
        pending: {
          $sum: { $cond: [{ $eq: [{ $ifNull: ["$driverStatus", "pending"] }, "pending"] }, 1, 0] },
        },
        total: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);

  // What the platform owes riders for work finished today, on the same UTC day
  // boundary the dashboard uses.
  const [payouts] = await OrderModel.aggregate<{ earningsToday: number }>([
    {
      $match: {
        status: "delivered",
        updatedAt: mongoose.trusted({ $gte: startOfUtcDay() }),
      },
    },
    { $group: { _id: null, earningsToday: { $sum: { $ifNull: ["$driverPayout.total", 0] } } } },
    { $project: { _id: 0 } },
  ]);

  const total = result?.count[0]?.total ?? 0;

  return {
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    riders: result?.rows ?? [],
    stats: {
      earningsToday: payouts?.earningsToday ?? 0,
      online: counts?.online ?? 0,
      pending: counts?.pending ?? 0,
      total: counts?.total ?? 0,
    },
    total,
  };
};

export const createRider = async (input: CreateRiderInput) => {
  const existing = await UserModel.findOne({ email: input.email }).exec();

  if (existing) throw new BadRequestException("That email is already registered");

  // An admin creating the account is the approval, so it starts ready to work.
  return UserModel.create({
    driverStatus: input.driverStatus,
    email: input.email,
    name: input.name,
    password: input.password,
    phone: input.phone,
    role: "driver",
  });
};

export const updateRider = async (riderId: string, input: UpdateRiderInput) => {
  const changes: Record<string, unknown> = {};

  for (const key of ["driverStatus", "isActive", "name", "phone", "rating"] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }

  // A rider who is no longer approved cannot sit in the queue as "online".
  if (input.driverStatus && input.driverStatus !== "approved") changes.isOnline = false;

  const rider = await UserModel.findOneAndUpdate({ _id: riderId, role: "driver" }, { $set: changes }, {
    returnDocument: "after",
  }).exec();

  if (!rider) throw new NotFoundException("Rider not found");

  return rider;
};
