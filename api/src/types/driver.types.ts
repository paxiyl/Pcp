/** Rider pay, the deliveries they see, and their daily summary. */

import { OrderDocument } from "../models/order.model";

export type DeliveryPayout = {
  base: number;
  distance: number;
  total: number;
  distanceKm: number;
};

export type DeliveryPayload = { order: OrderDocument; payout: DeliveryPayout };

export type DriverSummary = { deliveries: number; earnings: number; isOnline: boolean };
