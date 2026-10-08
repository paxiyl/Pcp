import mongoose, { PipelineStage } from "mongoose";

import { OrderDocument, OrderModel, OrderStatus } from "../models/order.model";
import { ProductModel } from "../models/product.model";
import { AdminOrderList, AdminOrderRow, AdminOrderStats } from "../types/admin-order.types";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import { refundOrder } from "./payment.service";
import { AdminOrderQuery } from "../validators/admin-order.validator";
import { pushStatus } from "./order.service";

/** Unpaid orders never became business, so the backoffice list hides them. */
const PAID_STATUSES: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

/** Waiting on the kitchen: what the "Awaiting action" card counts. */
const AWAITING_STATUSES: OrderStatus[] = ["confirmed", "preparing"];

const startOfUtcDay = () => {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const rangeStart = (range: AdminOrderQuery["range"]): Date | null => {
  if (range === "all") return null;

  const date = startOfUtcDay();

  if (range === "7d") date.setUTCDate(date.getUTCDate() - 6);
  if (range === "30d") date.setUTCDate(date.getUTCDate() - 29);

  return date;
};

/** Escaped so a customer typing "a.b" cannot smuggle a pattern into the query. */
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMatch = (query: AdminOrderQuery): PipelineStage.Match["$match"] => {
  const match: Record<string, unknown> = {
    status: mongoose.trusted({ $in: query.status ? [query.status] : PAID_STATUSES }),
  };

  const from = rangeStart(query.range);
  if (from) match.createdAt = mongoose.trusted({ $gte: from });

  if (query.restaurantId) match.restaurantId = new mongoose.Types.ObjectId(query.restaurantId);

  if (query.customerId) match.userId = new mongoose.Types.ObjectId(query.customerId);

  if (query.search) {
    const pattern = mongoose.trusted({ $options: "i", $regex: escapeRegex(query.search) });

    match.$or = [{ reference: pattern }, { contactName: pattern }];
  }

  return match;
};

/** Today's headline numbers, independent of whatever filter the table has. */
const loadStats = async (): Promise<AdminOrderStats> => {
  const today = startOfUtcDay();

  const [row] = await OrderModel.aggregate<AdminOrderStats>([
    { $match: { status: mongoose.trusted({ $in: PAID_STATUSES }) } },
    {
      $group: {
        _id: null,
        awaitingAction: {
          $sum: { $cond: [{ $in: ["$status", AWAITING_STATUSES] }, 1, 0] },
        },
        onDelivery: { $sum: { $cond: [{ $eq: ["$status", "out_for_delivery"] }, 1, 0] } },
        ordersToday: { $sum: { $cond: [{ $gte: ["$createdAt", today] }, 1, 0] } },
        revenueToday: {
          $sum: { $cond: [{ $gte: ["$createdAt", today] }, "$total", 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ]);

  return row ?? { awaitingAction: 0, onDelivery: 0, ordersToday: 0, revenueToday: 0 };
};

/**
 * One aggregation returns the page and the total: $facet runs both branches
 * over the same match, so the count can never disagree with the rows.
 */
export const listOrders = async (query: AdminOrderQuery): Promise<AdminOrderList> => {
  const match = buildMatch(query);
  const skip = (query.page - 1) * query.limit;

  const [result] = await OrderModel.aggregate<{
    rows: AdminOrderRow[];
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
            $project: {
              contactName: 1,
              createdAt: 1,
              driverName: "$driver.name",
              itemCount: { $sum: "$items.quantity" },
              paidAt: 1,
              reference: 1,
              restaurantName: 1,
              vendorKind: 1,
              paymentMethod: 1,
              // Orders placed before payouts were snapshotted have none.
              restaurantPayout: { $ifNull: ["$restaurantPayout", 0] },
              status: 1,
              total: 1,
            },
          },
        ],
      },
    },
  ]);

  const total = result?.count[0]?.total ?? 0;

  return {
    orders: result?.rows ?? [],
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    stats: await loadStats(),
    total,
  };
};

export const findOrder = async (orderId: string): Promise<OrderDocument> => {
  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Order not found");

  return order;
};

/**
 * What an admin may move an order to. The kitchen path is theirs; picking up
 * and delivering belong to the rider, so they are not offered here.
 */
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["cancelled"],
};

/**
 * Frees an order whose rider has gone quiet, putting it back on the open queue
 * for anyone to claim. Admins never choose who takes a job — riders claim for
 * themselves — but a stranded order has to be recoverable.
 */
export const releaseRider = async (
  orderId: string,
  adminName: string,
): Promise<OrderDocument> => {
  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Order not found");
  if (!order.driver) throw new BadRequestException("No rider is assigned to this order");

  if (order.status !== "ready" && order.status !== "out_for_delivery") {
    throw new BadRequestException("Only an order still on its way can be released");
  }

  const riderName = order.driver.name;

  order.set("driver", undefined);
  order.set("driverPayout", undefined);

  // It is no longer on its way, so it goes back to waiting for collection.
  pushStatus(order, "ready", `Released from ${riderName} by ${adminName}`);
  await order.save();

  return order;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  adminName: string,
): Promise<OrderDocument> => {
  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Order not found");

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];

  if (!allowed.includes(status)) {
    throw new BadRequestException(
      `An order that is ${order.status.replace(/_/g, " ")} cannot be moved to ${status.replace(/_/g, " ")}`,
    );
  }

  pushStatus(order, status, `Set to ${status.replace(/_/g, " ")} by ${adminName}`);
  await order.save();

  return order;
};

/**
 * Refunds an order from the backoffice, and puts the stock back.
 *
 * Restoring stock matters more than it looks: a cancelled grocery order that
 * leaves its items decremented silently shrinks a shelf every time, and a kirana
 * with single-digit counts notices within a day.
 *
 * Partial refunds are allowed — a missing item rather than a failed order — but
 * stock is only restored on a FULL refund, because a partial refund does not say
 * which line it was for.
 */
export const refundAdminOrder = async (
  orderId: string,
  input: { amount?: number; reason: string },
): Promise<OrderDocument> => {
  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Order not found");

  const alreadyRefunded = order.refundedAmount ?? 0;
  const refundable = order.total - alreadyRefunded;

  if (refundable <= 0) throw new BadRequestException("This order has already been fully refunded");
  if (!order.paidAt && order.paymentMethod !== "cod") {
    throw new BadRequestException("This order was never paid, so there is nothing to refund");
  }

  const amount = input.amount ?? refundable;

  if (amount <= 0 || amount > refundable) {
    throw new BadRequestException(
      `Refund must be between 1 paisa and ${refundable} paise (the unrefunded balance)`,
    );
  }

  const result = await refundOrder(order, amount, input.reason, alreadyRefunded);

  // Credit what the gateway actually moved rather than what we asked it to. An
  // idempotent replay returns the earlier, smaller figure, and books that count
  // the request instead of the refund would quietly overstate what was paid back.
  const refundedTotal = alreadyRefunded + result.amount;
  const full = refundedTotal >= order.total;

  order.refundedAmount = refundedTotal;
  order.refundedAt = new Date();
  order.refundReason = input.reason;
  if (result.refundId) order.refundId = result.refundId;

  // A fully refunded order is a cancelled one; a partial refund leaves the order
  // standing because the rest of it is still being delivered.
  if (full && order.status !== "cancelled") {
    pushStatus(
      order,
      "cancelled",
      result.via === "manual"
        ? "Cancelled — cash refund to be settled by the shop"
        : "Cancelled and refunded",
    );
  }

  await order.save();

  if (full) await restoreStock(order);

  return order;
};

/** Puts a cancelled order's products back on the shelf. */
const restoreStock = async (order: OrderDocument): Promise<void> => {
  for (const item of order.items) {
    if (!item.productId) continue;

    await ProductModel.updateOne(
      { _id: item.productId },
      { $inc: { stock: item.quantity } },
    ).exec();
  }
};
