/** Server-computed basket totals and the payload built around them. */

import { BasketDocument, VendorKind } from "../models/basket.model";
import { RestaurantDocument } from "../models/restaurant.model";
import { StoreDocument } from "../models/store.model";

export type BasketTotals = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  itemCount: number;
  minOrder: number;
  belowMinimum: boolean;
  freeDeliveryThreshold: number | null;
  /** How much more to spend to earn free delivery, or null when not applicable. */
  amountToFreeDelivery: number | null;
  /**
   * Total printed MRP minus what is actually being charged, in paise. Only store
   * lines carry an MRP, so this is 0 for a restaurant basket. Drives the
   * "You save ₹x" line the cart checklist asks for.
   */
  savings: number;
};

/**
 * The fee terms a basket is priced against, lifted out of whichever vendor owns
 * it. `computeTotals` takes this rather than a restaurant, so one pricing path
 * serves both catalogues and there is no second copy of the free-delivery rule.
 */
export type VendorFees = {
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold: number | null;
};

/** Enough to render the basket header without the client knowing which model it is. */
export type VendorSummary = {
  kind: VendorKind;
  id: string;
  name: string;
  imageUrl: string;
  /** Single number for a store; the top of the prep range for a restaurant. */
  etaMinutes: number;
  isOpen: boolean;
};

/** Which payment methods this basket may actually use, decided server-side. */
export type BasketPaymentOptions = {
  codAvailable: boolean;
  codMaxOrderValue: number;
  /** Shown next to a disabled cash option. Absent when it is available. */
  codUnavailableReason?: string;
};

export type BasketPayload = {
  basket: BasketDocument | null;
  /**
   * Kept for the mobile app, which still reads `restaurant` on the basket screen.
   * Null for a store basket — read `vendor` instead, which is populated for both.
   */
  restaurant: RestaurantDocument | null;
  store: StoreDocument | null;
  vendor: VendorSummary | null;
  totals: BasketTotals;
  payment: BasketPaymentOptions;
};
