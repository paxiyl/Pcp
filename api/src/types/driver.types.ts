/** Rider pay, the deliveries they see, and their daily summary. */

import { OrderDocument } from "../models/order.model";

export type DeliveryPayout = {
  base: number;
  distance: number;
  total: number;
  distanceKm: number;
};

export type DeliveryPayload = { order: OrderDocument; payout: DeliveryPayout };

export type DriverSummary = {
  deliveries: number;
  earnings: number;
  isOnline: boolean;
  /**
   * What this rider still owes the office, across every unsettled delivery —
   * not just today's. Cash they collected at doors, less the earnings they are
   * allowed to keep out of it. Negative means we owe them instead, which is the
   * normal state for a rider doing only prepaid work.
   *
   * Deliberately on the daily summary rather than a screen of its own: a rider
   * carrying somebody else's money should see the number every time they open
   * the app, not when they think to go looking for it.
   */
  cashToHandOver: number;
  /** Unsettled deliveries behind that figure, so it can be checked. */
  unsettledDeliveries: number;
};
