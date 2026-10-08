import mongoose from "mongoose";

import { OrderDocument, OrderModel, OrderPoint } from "../models/order.model";
import { UserDocument, UserModel } from "../models/user.model";
import { DeliveryPayload, DeliveryPayout, DriverSummary } from "../types/driver.types";
import { DriverPayRates } from "../types/settings.types";
import { BadRequestException, ForbiddenException, NotFoundException } from "../utils/app-error";
import { pushStatus } from "./order.service";
import { markCodCollected } from "./order.service";
import { getDriverPayRates } from "./settings.service";

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Straight-line distance. Real road distance needs a routing service. */
export const distanceKm = (from?: OrderPoint, to?: OrderPoint): number => {
  if (!from || !to) return 0;

  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Rider pay: a flat fee plus distance, both set by an admin in platform
 * settings. Computed in one place and snapshotted onto the order when claimed,
 * so a later rate change never rewrites what a rider already earned.
 */
export const payoutFor = (order: OrderDocument, rates: DriverPayRates): DeliveryPayout => {
  const km = distanceKm(order.restaurantLocation, order.deliveryLocation);
  const distance = Math.round(km * rates.payPerKm);

  return {
    base: rates.basePay,
    distance,
    distanceKm: Math.round(km * 10) / 10,
    total: rates.basePay + distance,
  };
};

/**
 * Riders are vetted: an application waiting on an admin, or an account an admin
 * has suspended, can sign in and look but never take work.
 */
export const assertApproved = (driver: UserDocument): void => {
  if (driver.driverStatus === "approved") return;

  throw new ForbiddenException(
    driver.driverStatus === "suspended"
      ? "Your rider account is suspended. Contact support."
      : "Your rider account is waiting for approval.",
  );
};

const withPayout = (order: OrderDocument, rates: DriverPayRates): DeliveryPayload => ({
  order,
  // A claimed delivery keeps the rate it was claimed at.
  payout: order.driverPayout ?? payoutFor(order, rates),
});

/**
 * The open queue: orders the kitchen has finished that nobody has claimed.
 * Any driver can see them, which is why nothing here is filtered by driver id.
 */
export const listReadyDeliveries = async (): Promise<DeliveryPayload[]> => {
  const [orders, rates] = await Promise.all([
    OrderModel.find({
      driver: mongoose.trusted({ $exists: false }),
      status: "ready",
    })
      .sort({ createdAt: 1 })
      .limit(50)
      .exec(),
    getDriverPayRates(),
  ]);

  return orders.map((order) => withPayout(order, rates));
};

/** Deliveries this driver has claimed and not yet finished. */
export const listMyDeliveries = async (driverId: string): Promise<DeliveryPayload[]> => {
  const [orders, rates] = await Promise.all([
    OrderModel.find({
      "driver.driverId": driverId,
      status: mongoose.trusted({ $in: ["ready", "out_for_delivery"] }),
    })
      .sort({ createdAt: 1 })
      .exec(),
    getDriverPayRates(),
  ]);

  return orders.map((order) => withPayout(order, rates));
};

/**
 * A driver may open an unclaimed ready order (to decide) or one they already
 * hold. Anything else belongs to another rider and stays invisible.
 */
export const findDelivery = async (
  driverId: string,
  orderId: string,
): Promise<DeliveryPayload> => {
  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Delivery not found");

  const mine = order.driver?.driverId?.toString() === driverId;
  const claimable = !order.driver && order.status === "ready";

  if (!mine && !claimable) throw new NotFoundException("Delivery not found");

  return withPayout(order, await getDriverPayRates());
};

const driverSnapshot = (driver: UserDocument) => ({
  avatarUrl: "",
  driverId: driver._id,
  name: driver.name,
  phone: driver.phone,
  rating: driver.rating,
  ratingCount: driver.ratingCount,
});

/**
 * Claiming is a race between riders, so the guard lives in the query: only the
 * update that still matches an unclaimed ready order wins.
 */
export const claimDelivery = async (
  driver: UserDocument,
  orderId: string,
): Promise<DeliveryPayload> => {
  assertApproved(driver);

  const order = await OrderModel.findById(orderId).exec();

  if (!order) throw new NotFoundException("Delivery not found");
  if (order.driver) {
    throw new BadRequestException(
      order.driver.driverId?.toString() === driver._id.toString()
        ? "You have already claimed this delivery"
        : "Another rider claimed this delivery",
    );
  }
  if (order.status !== "ready") {
    throw new BadRequestException("This order is not ready for collection yet");
  }

  const rates = await getDriverPayRates();
  const payout = payoutFor(order, rates);
  const claimed = await OrderModel.findOneAndUpdate(
    { _id: order._id, driver: mongoose.trusted({ $exists: false }), status: "ready" },
    {
      $set: { driver: driverSnapshot(driver), driverPayout: payout },
      $push: {
        statusHistory: { at: new Date(), note: `Claimed by ${driver.name}`, status: "ready" },
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!claimed) throw new BadRequestException("Another rider claimed this delivery");

  return withPayout(claimed, rates);
};

const mine = async (driverId: string, orderId: string): Promise<OrderDocument> => {
  const order = await OrderModel.findOne({ _id: orderId, "driver.driverId": driverId }).exec();

  if (!order) throw new NotFoundException("Delivery not found");

  return order;
};

export const markPickedUp = async (
  driverId: string,
  orderId: string,
): Promise<DeliveryPayload> => {
  const order = await mine(driverId, orderId);

  if (order.status !== "ready") throw new BadRequestException("This delivery is already on its way");

  pushStatus(order, "out_for_delivery", "Rider picked up your order");
  await order.save();

  return withPayout(order, await getDriverPayRates());
};

export const markDelivered = async (
  driverId: string,
  orderId: string,
  code: string,
): Promise<DeliveryPayload> => {
  // Selected explicitly: the code is hidden from every other rider read.
  const order = await OrderModel.findOne({ _id: orderId, "driver.driverId": driverId })
    .select("+deliveryCode")
    .exec();

  if (!order) throw new NotFoundException("Delivery not found");

  if (order.status !== "out_for_delivery") {
    throw new BadRequestException("Pick the order up before delivering it");
  }

  if (order.deliveryCode !== code) {
    throw new BadRequestException("That code does not match. Ask the customer to read it again.");
  }

  pushStatus(order, "delivered", "Delivered to your door");
  await order.save();

  // Handing over the goods is also the moment the cash changes hands. The
  // delivery code has already proved the rider is at the right door, so there
  // is no separate confirmation step for the money.
  await markCodCollected(order);

  return withPayout(order, await getDriverPayRates());
};

export const setOnline = async (driver: UserDocument, isOnline: boolean): Promise<boolean> => {
  if (isOnline) assertApproved(driver);

  await UserModel.updateOne({ _id: driver._id }, { isOnline }).exec();

  return isOnline;
};

/** What the rider has earned since midnight, from their own completed runs. */
export const todaySummary = async (driver: UserDocument): Promise<DriverSummary> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const orders = await OrderModel.find({
    "driver.driverId": driver._id,
    status: "delivered",
    updatedAt: mongoose.trusted({ $gte: startOfDay }),
  }).exec();

  return {
    deliveries: orders.length,
    earnings: orders.reduce((total, order) => total + (order.driverPayout?.total ?? 0), 0),
    isOnline: driver.isOnline,
  };
};
