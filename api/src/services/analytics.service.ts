import mongoose from "mongoose";

import { OrderModel, OrderStatus } from "../models/order.model";
import {
  ActivityEvent,
  OverviewPayload,
  PaymentSplit,
  RecentOrder,
  RevenuePoint,
  StatusCount,
  Totals,
  VendorSplit,
} from "../types/analytics.types";

/** Unpaid orders never became business, so they stay out of every figure. */
const PAID_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
];

/** Still moving towards a customer: what the sidebar badge counts. */
const LIVE_STATUSES: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery"];

const paid = () => mongoose.trusted({ $in: PAID_STATUSES });

/**
 * Day boundaries are UTC, matching $dateToString below. Using local time here
 * and UTC in the pipeline would bucket the same order into different days.
 */
const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);

  return copy;
};

const daysAgo = (days: number) => {
  const date = startOfDay(new Date());
  date.setUTCDate(date.getUTCDate() - days);

  return date;
};

const EMPTY_TOTALS: Totals = {
  averageOrderValue: 0,
  commission: 0,
  orders: 0,
  revenue: 0,
  riderPayouts: 0,
};

/**
 * One pass over a date window. Everything the stat cards show comes from this,
 * so today and yesterday are measured exactly the same way.
 */
const totalsBetween = async (from: Date, to: Date): Promise<Totals> => {
  const [row] = await OrderModel.aggregate<Totals & { _id: null }>([
    { $match: { createdAt: mongoose.trusted({ $gte: from, $lt: to }), status: paid() } },
    {
      $group: {
        _id: null,
        commission: { $sum: "$commission" },
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
        riderPayouts: { $sum: { $ifNull: ["$driverPayout.total", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        averageOrderValue: {
          $cond: [{ $gt: ["$orders", 0] }, { $round: [{ $divide: ["$revenue", "$orders"] }, 0] }, 0],
        },
        commission: 1,
        orders: 1,
        revenue: 1,
        riderPayouts: 1,
      },
    },
  ]);

  return row ?? EMPTY_TOTALS;
};

/** Daily revenue and commission, with empty days filled in so the line is continuous. */
const revenueSeries = async (days: number): Promise<RevenuePoint[]> => {
  const from = daysAgo(days - 1);

  const rows = await OrderModel.aggregate<RevenuePoint>([
    { $match: { createdAt: mongoose.trusted({ $gte: from }), status: paid() } },
    {
      $group: {
        _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d" } },
        commission: { $sum: "$commission" },
        revenue: { $sum: "$total" },
      },
    },
    { $project: { _id: 0, commission: 1, date: "$_id", revenue: 1 } },
    { $sort: { date: 1 } },
  ]);

  const byDate = new Map(rows.map((row) => [row.date, row]));

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(from);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);

    return byDate.get(key) ?? { commission: 0, date: key, revenue: 0 };
  });
};

const ordersByStatus = async (): Promise<StatusCount[]> => {
  const rows = await OrderModel.aggregate<StatusCount>([
    { $match: { status: paid() } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $project: { _id: 0, count: 1, status: "$_id" } },
  ]);

  const byStatus = new Map(rows.map((row) => [row.status, row.count]));

  // Fixed order and every bucket present, so the legend never reshuffles.
  return PAID_STATUSES.map((status) => ({ count: byStatus.get(status) ?? 0, status }));
};

const recentOrders = (limit: number) =>
  OrderModel.aggregate<RecentOrder>([
    { $match: { status: paid() } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        contactName: 1,
        createdAt: 1,
        reference: 1,
        restaurantName: 1,
        status: 1,
        total: 1,
      },
    },
  ]);

/**
 * The live feed, rebuilt from the status history every order already carries.
 * There is no events collection, so this unwinds the trail instead.
 */
const recentActivity = (limit: number) =>
  OrderModel.aggregate<ActivityEvent>([
    { $match: { status: paid() } },
    { $unwind: "$statusHistory" },
    { $sort: { "statusHistory.at": -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        at: "$statusHistory.at",
        note: "$statusHistory.note",
        orderId: "$_id",
        reference: 1,
        restaurantName: 1,
        status: "$statusHistory.status",
      },
    },
  ]);

/**
 * Where the money came from, over the window the dashboard is showing.
 *
 * Grouped on `vendorKind`, which defaults to "restaurant" on every order written
 * before stores existed — so historic orders land in the right bucket without a
 * backfill.
 */
const vendorSplit = (from: Date): Promise<VendorSplit[]> =>
  OrderModel.aggregate<VendorSplit>([
    { $match: { createdAt: mongoose.trusted({ $gte: from }), status: paid() } },
    {
      $group: {
        _id: { $ifNull: ["$vendorKind", "restaurant"] },
        commission: { $sum: "$commission" },
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $project: { _id: 0, commission: 1, orders: 1, revenue: 1, vendorKind: "$_id" } },
    { $sort: { revenue: -1 } },
  ]);

/**
 * How people are paying. Operationally this is the cash-float number: the COD
 * share is money riders are carrying around Hindaun on any given day.
 */
const paymentSplit = (from: Date): Promise<PaymentSplit[]> =>
  OrderModel.aggregate<PaymentSplit>([
    { $match: { createdAt: mongoose.trusted({ $gte: from }), status: paid() } },
    {
      $group: {
        _id: { $ifNull: ["$paymentMethod", "card"] },
        orders: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $project: { _id: 0, orders: 1, paymentMethod: "$_id", revenue: 1 } },
    { $sort: { revenue: -1 } },
  ]);

export const getOverview = async (days: number): Promise<OverviewPayload> => {
  const todayStart = startOfDay(new Date());
  const tomorrow = new Date(todayStart);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const yesterdayStart = daysAgo(1);

  const [today, yesterday, series, byStatus, recent, activity, liveOrders, vendors, payments] =
    await Promise.all([
    totalsBetween(todayStart, tomorrow),
    totalsBetween(yesterdayStart, todayStart),
    revenueSeries(days),
    ordersByStatus(),
    recentOrders(5),
    recentActivity(6),
    OrderModel.countDocuments({ status: mongoose.trusted({ $in: LIVE_STATUSES }) }),
    vendorSplit(daysAgo(days)),
    paymentSplit(daysAgo(days)),
  ]);

  return {
    activity,
    byStatus,
    liveOrders,
    paymentSplit: payments,
    recent,
    series,
    today,
    vendorSplit: vendors,
    yesterday,
  };
};
