import mongoose from "mongoose";

import { OrderModel } from "../models/order.model";
import { UserModel } from "../models/user.model";
import { AdminCustomerList, AdminCustomerRow, AdminCustomerStats } from "../types/admin-customer.types";
import { NotFoundException } from "../utils/app-error";
import { AdminCustomerQuery, UpdateCustomerInput } from "../validators/admin-customer.validator";

/** Only orders that were actually paid for count as ordering activity. */
const PAID_STATUSES = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const startOfUtcMonth = () => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const SORTS: Record<AdminCustomerQuery["sort"], Record<string, 1 | -1>> = {
  joined: { createdAt: -1 },
  orders: { orders: -1, createdAt: -1 },
  spend: { totalSpent: -1, createdAt: -1 },
};

const buildMatch = (query: AdminCustomerQuery) => {
  const match: Record<string, unknown> = { role: "customer" };

  if (query.status === "active") match.isActive = true;
  if (query.status === "suspended") match.isActive = false;

  if (query.search) {
    const pattern = mongoose.trusted({ $options: "i", $regex: escapeRegex(query.search) });

    match.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }

  return match;
};

/**
 * Customers with their ordering history attached. The order summary is joined
 * before the sort so "most orders" and "highest spend" can sort by it; at this
 * scale that is one pass, not a query per customer.
 */
export const listCustomers = async (query: AdminCustomerQuery): Promise<AdminCustomerList> => {
  const skip = (query.page - 1) * query.limit;

  const [result] = await UserModel.aggregate<{
    rows: AdminCustomerRow[];
    count: { total: number }[];
  }>([
    { $match: buildMatch(query) },
    {
      $lookup: {
        as: "orderSummary",
        from: "orders",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", "$$userId"] },
                  { $in: ["$status", PAID_STATUSES] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              lastOrderAt: { $max: "$createdAt" },
              orders: { $sum: 1 },
              totalSpent: { $sum: "$total" },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        lastOrderAt: { $first: "$orderSummary.lastOrderAt" },
        orders: { $ifNull: [{ $first: "$orderSummary.orders" }, 0] },
        totalSpent: { $ifNull: [{ $first: "$orderSummary.totalSpent" }, 0] },
      },
    },
    { $sort: SORTS[query.sort] },
    {
      $facet: {
        count: [{ $count: "total" }],
        rows: [
          { $skip: skip },
          { $limit: query.limit },
          {
            $project: {
              createdAt: 1,
              email: 1,
              isActive: 1,
              lastOrderAt: 1,
              name: 1,
              orders: 1,
              phone: 1,
              totalSpent: 1,
            },
          },
        ],
      },
    },
  ]);

  const month = startOfUtcMonth();

  const [counts] = await UserModel.aggregate<{ total: number; newThisMonth: number }>([
    { $match: { role: "customer" } },
    {
      $group: {
        _id: null,
        newThisMonth: { $sum: { $cond: [{ $gte: ["$createdAt", month] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
    { $project: { _id: 0 } },
  ]);

  // "Active" means they ordered this month, so it is counted from orders.
  const [active] = await OrderModel.aggregate<{ activeThisMonth: number }>([
    {
      $match: {
        createdAt: mongoose.trusted({ $gte: month }),
        status: mongoose.trusted({ $in: PAID_STATUSES }),
      },
    },
    { $group: { _id: "$userId" } },
    { $count: "activeThisMonth" },
  ]);

  const total = result?.count[0]?.total ?? 0;

  return {
    customers: result?.rows ?? [],
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    stats: {
      activeThisMonth: active?.activeThisMonth ?? 0,
      newThisMonth: counts?.newThisMonth ?? 0,
      total: counts?.total ?? 0,
    },
    total,
  };
};

/**
 * Suspending flips isActive, which the login and the JWT strategy already
 * refuse, so the customer is signed out of the app on their next request.
 */
export const updateCustomer = async (customerId: string, input: UpdateCustomerInput) => {
  const customer = await UserModel.findOneAndUpdate(
    { _id: customerId, role: "customer" },
    { $set: { isActive: input.isActive } },
    { returnDocument: "after" },
  ).exec();

  if (!customer) throw new NotFoundException("Customer not found");

  return customer;
};
