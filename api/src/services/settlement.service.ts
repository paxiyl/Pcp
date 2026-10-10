import mongoose, { QueryFilter, Types } from "mongoose";

import { OrderDocument, OrderModel } from "../models/order.model";
import {
  SettlementDirection,
  SettlementDocument,
  SettlementModel,
  SettlementParty,
} from "../models/settlement.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";

/**
 * Settling up.
 *
 * Two separate ledgers, because cash on delivery splits one payment three ways.
 * A rider who collects ₹500 at a door is holding the shop's goods money, our
 * commission and fees, and their own earnings, all at once:
 *
 *   RIDERS owe us the cash they collected, less what they earned. A rider with
 *   no cash orders is owed their earnings instead, so this leg runs both ways.
 *
 *   SHOPS AND KITCHENS are owed the value of goods they sold, less our
 *   commission — regardless of how the customer paid, because whoever held the
 *   money in between, the shop's share is the same.
 *
 * Only DELIVERED orders count. An order still in flight has no settled goods
 * and no collected cash, and an order that was cancelled or refunded never
 * will have.
 */

type Leg = "riderSettlementId" | "vendorSettlementId";

/** Delivered and not yet squared up on the given leg. */
const outstandingFilter = (leg: Leg): QueryFilter<OrderDocument> => ({
  status: "delivered",
  [leg]: mongoose.trusted({ $exists: false }),
});

export type RiderBalance = {
  riderId: string;
  name: string;
  phone?: string;
  orderCount: number;
  /** Cash taken at doors on these orders. */
  cashCollected: number;
  /** Earnings due on these orders. */
  earnings: number;
  /**
   * Positive: the rider owes us this much. Negative: we owe the rider.
   * A rider doing only prepaid work is always negative.
   */
  net: number;
  /** The oldest unsettled delivery, so a stale balance is visible as stale. */
  oldestAt?: Date;
};

export type VendorBalance = {
  vendorId: string;
  kind: "store" | "restaurant";
  name: string;
  orderCount: number;
  /** What the goods sold for, before our cut. */
  goodsValue: number;
  commission: number;
  /** What we owe the shop. Never negative: commission is capped at goods value. */
  net: number;
  oldestAt?: Date;
};

export type OutstandingSummary = {
  riders: RiderBalance[];
  vendors: VendorBalance[];
  totals: {
    /** Net cash sitting with riders that belongs to us. */
    cashWithRiders: number;
    /** Earnings owed to riders who hold no cash to offset them. */
    owedToRiders: number;
    owedToVendors: number;
  };
};

/* -------------------------------------------------------------------------- */
/* What is outstanding                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Cash a rider is holding is COLLECTED cash, not the order total: an order
 * marked cash-on-delivery whose `codCollectedAt` never got stamped was not
 * actually paid at the door, and charging the rider for it would be wrong.
 */
const cashOn = (order: OrderDocument): number =>
  order.paymentMethod === "cod" && order.codCollectedAt ? (order.total ?? 0) : 0;

const earningsOn = (order: OrderDocument): number => order.driverPayout?.total ?? 0;

export const getOutstanding = async (): Promise<OutstandingSummary> => {
  const [riderOrders, vendorOrders] = await Promise.all([
    OrderModel.find({
      ...outstandingFilter("riderSettlementId"),
      "driver.driverId": mongoose.trusted({ $exists: true }),
    } as QueryFilter<OrderDocument>)
      .select("driver driverPayout paymentMethod codCollectedAt total updatedAt")
      .exec(),
    OrderModel.find(outstandingFilter("vendorSettlementId"))
      .select(
        "vendorKind storeId restaurantId restaurantName subtotal commission restaurantPayout updatedAt",
      )
      .exec(),
  ]);

  const riders = new Map<string, RiderBalance>();

  for (const order of riderOrders) {
    const id = order.driver?.driverId?.toString();

    if (!id) continue;

    const current =
      riders.get(id) ??
      {
        cashCollected: 0,
        earnings: 0,
        name: order.driver?.name ?? "Rider",
        net: 0,
        orderCount: 0,
        phone: order.driver?.phone,
        riderId: id,
      };

    current.orderCount += 1;
    current.cashCollected += cashOn(order);
    current.earnings += earningsOn(order);
    current.net = current.cashCollected - current.earnings;

    const at = order.updatedAt;

    if (!current.oldestAt || at < current.oldestAt) current.oldestAt = at;

    riders.set(id, current);
  }

  const vendors = new Map<string, VendorBalance>();

  for (const order of vendorOrders) {
    const kind = order.vendorKind === "store" ? "store" : "restaurant";
    const id = (kind === "store" ? order.storeId : order.restaurantId)?.toString();

    if (!id) continue;

    const key = `${kind}:${id}`;
    const current =
      vendors.get(key) ??
      {
        commission: 0,
        goodsValue: 0,
        kind: kind as "store" | "restaurant",
        name: order.restaurantName,
        net: 0,
        orderCount: 0,
        vendorId: id,
      };

    current.orderCount += 1;
    current.goodsValue += order.subtotal ?? 0;
    current.commission += order.commission ?? 0;
    // Taken from the stored payout rather than recomputed: a commission rate
    // changed last week must not rewrite what a shop was owed last month.
    current.net += order.restaurantPayout ?? 0;

    const at = order.updatedAt;

    if (!current.oldestAt || at < current.oldestAt) current.oldestAt = at;

    vendors.set(key, current);
  }

  const riderList = [...riders.values()].sort((a, b) => b.net - a.net);
  const vendorList = [...vendors.values()].sort((a, b) => b.net - a.net);

  return {
    riders: riderList,
    totals: {
      cashWithRiders: riderList.reduce((sum, rider) => sum + Math.max(rider.net, 0), 0),
      owedToRiders: riderList.reduce((sum, rider) => sum + Math.max(-rider.net, 0), 0),
      owedToVendors: vendorList.reduce((sum, vendor) => sum + vendor.net, 0),
    },
    vendors: vendorList,
  };
};

/* -------------------------------------------------------------------------- */
/* Settling                                                                   */
/* -------------------------------------------------------------------------- */

type SettleResult = { settlement: SettlementDocument };

/**
 * Stamps the orders, then trues the run up to what was actually stamped.
 *
 * There is no transaction here on purpose: this deployment cannot assume a
 * replica set. Instead the stamp is conditional on the leg still being unset,
 * so two admins pressing Settle at the same moment cannot both claim the same
 * order — and whichever run loses an order is corrected to match reality
 * rather than left overstating what it covered.
 */
const stampAndTrue = async (
  settlement: SettlementDocument,
  leg: Leg,
  orderIds: Types.ObjectId[],
  recompute: (orders: OrderDocument[]) => Partial<SettlementDocument>,
): Promise<SettlementDocument> => {
  const stamp = await OrderModel.updateMany(
    { _id: mongoose.trusted({ $in: orderIds }), [leg]: mongoose.trusted({ $exists: false }) },
    { $set: { [leg]: settlement._id } },
  ).exec();

  if (stamp.modifiedCount === orderIds.length) return settlement;

  const claimed = await OrderModel.find({ [leg]: settlement._id }).exec();

  if (claimed.length === 0) {
    // Everything was taken by a concurrent run. Leave no empty record behind.
    await settlement.deleteOne();

    throw new BadRequestException("Those orders were just settled by someone else");
  }

  Object.assign(settlement, recompute(claimed), {
    orderCount: claimed.length,
    orderIds: claimed.map((order) => order._id),
  });

  await settlement.save();

  return settlement;
};

const directionFor = (net: number): SettlementDirection => (net >= 0 ? "incoming" : "outgoing");

/**
 * Squares up with one rider: the cash they collected against what they earned.
 *
 * `expectedNet` is the figure the admin was looking at when they pressed the
 * button. If a delivery landed in between, the numbers no longer match what was
 * on screen, and the run is refused rather than settled for an amount nobody
 * agreed to.
 */
export const settleRider = async (
  riderId: string,
  input: { settledBy: string; note?: string; expectedNet?: number },
): Promise<SettleResult> => {
  const riderFilter: QueryFilter<OrderDocument> = {
    ...outstandingFilter("riderSettlementId"),
    "driver.driverId": new Types.ObjectId(riderId),
  };

  const orders = await OrderModel.find(riderFilter).exec();

  if (orders.length === 0) throw new NotFoundException("This rider has nothing outstanding");

  const totals = orders.reduce(
    (sum, order) => ({
      cashCollected: sum.cashCollected + cashOn(order),
      riderEarnings: sum.riderEarnings + earningsOn(order),
    }),
    { cashCollected: 0, riderEarnings: 0 },
  );

  const net = totals.cashCollected - totals.riderEarnings;

  if (input.expectedNet !== undefined && input.expectedNet !== net) {
    throw new BadRequestException(
      "This rider's balance changed just now. Reload and check the figure before settling.",
    );
  }

  const settlement = await SettlementModel.create({
    amount: Math.abs(net),
    cashCollected: totals.cashCollected,
    direction: directionFor(net),
    note: input.note,
    orderCount: orders.length,
    orderIds: orders.map((order) => order._id),
    party: "rider" satisfies SettlementParty,
    partyName: orders[0]?.driver?.name ?? "Rider",
    riderEarnings: totals.riderEarnings,
    riderId: new Types.ObjectId(riderId),
    settledAt: new Date(),
    settledBy: new Types.ObjectId(input.settledBy),
  });

  const trued = await stampAndTrue(
    settlement,
    "riderSettlementId",
    orders.map((order) => order._id),
    (claimed) => {
      const cash = claimed.reduce((sum, order) => sum + cashOn(order), 0);
      const earned = claimed.reduce((sum, order) => sum + earningsOn(order), 0);

      return {
        amount: Math.abs(cash - earned),
        cashCollected: cash,
        direction: directionFor(cash - earned),
        riderEarnings: earned,
      };
    },
  );

  return { settlement: trued };
};

/** Squares up with one shop or kitchen: goods sold, less our commission. */
export const settleVendor = async (
  kind: "store" | "restaurant",
  vendorId: string,
  input: { settledBy: string; note?: string; expectedNet?: number },
): Promise<SettleResult> => {
  // Built as one object rather than spread inline: a conditional spread into
  // `find` loses Mongoose's typed filter overload and with it the result type.
  const vendorFilter: QueryFilter<OrderDocument> =
    kind === "store"
      ? { ...outstandingFilter("vendorSettlementId"), storeId: new Types.ObjectId(vendorId) }
      : {
          ...outstandingFilter("vendorSettlementId"),
          restaurantId: new Types.ObjectId(vendorId),
        };

  const orders = await OrderModel.find(vendorFilter).exec();

  if (orders.length === 0) throw new NotFoundException("This vendor has nothing outstanding");

  const totals = orders.reduce(
    (sum, order) => ({
      commission: sum.commission + (order.commission ?? 0),
      goodsValue: sum.goodsValue + (order.subtotal ?? 0),
      net: sum.net + (order.restaurantPayout ?? 0),
    }),
    { commission: 0, goodsValue: 0, net: 0 },
  );

  if (input.expectedNet !== undefined && input.expectedNet !== totals.net) {
    throw new BadRequestException(
      "This vendor's balance changed just now. Reload and check the figure before settling.",
    );
  }

  const settlement = await SettlementModel.create({
    amount: totals.net,
    commission: totals.commission,
    // We always pay a vendor; the commission is already deducted.
    direction: "outgoing" satisfies SettlementDirection,
    goodsValue: totals.goodsValue,
    note: input.note,
    orderCount: orders.length,
    orderIds: orders.map((order) => order._id),
    party: kind satisfies SettlementParty,
    partyName: orders[0]?.restaurantName ?? "Vendor",
    settledAt: new Date(),
    settledBy: new Types.ObjectId(input.settledBy),
    ...(kind === "store"
      ? { storeId: new Types.ObjectId(vendorId) }
      : { restaurantId: new Types.ObjectId(vendorId) }),
  });

  const trued = await stampAndTrue(
    settlement,
    "vendorSettlementId",
    orders.map((order) => order._id),
    (claimed) => ({
      amount: claimed.reduce((sum, order) => sum + (order.restaurantPayout ?? 0), 0),
      commission: claimed.reduce((sum, order) => sum + (order.commission ?? 0), 0),
      goodsValue: claimed.reduce((sum, order) => sum + (order.subtotal ?? 0), 0),
    }),
  );

  return { settlement: trued };
};

/** The paid-out history, newest first. */
export const listSettlements = async (options?: {
  party?: SettlementParty;
  limit?: number;
}): Promise<SettlementDocument[]> =>
  SettlementModel.find(options?.party ? { party: options.party } : {})
    .sort({ settledAt: -1 })
    .limit(Math.min(options?.limit ?? 50, 200))
    .populate("settledBy", "name email")
    .exec();
