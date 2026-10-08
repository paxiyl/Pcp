/** Checkout and reorder results. */

import { OrderDocument } from "../models/order.model";
import { CheckoutSession } from "../services/payment.service";

export type CheckoutPayload = {
  order: OrderDocument;
  /**
   * Null for cash on delivery: there is no sheet to open, the order is already
   * confirmed, and the client should go straight to tracking.
   */
  checkout: CheckoutSession | null;
};

export type ReorderResult = { added: number; skipped: string[] };
