/**
 * The product catalogue, mobile side.
 *
 * These types are the contract the Phase 2 API work has to satisfy. They live
 * here rather than in `lib/api.ts` so the grocery catalogue can be built and
 * reviewed without disturbing the restaurant/dish types that are already in
 * production use.
 *
 * Money is in minor units (paise) everywhere, matching the rest of the platform.
 */

/** A shop in Hindaun: kirana, chemist, electronics, bakery, dairy. */
export type Store = {
  _id: string;
  name: string;
  slug: string;
  /** "Kirana", "Chemist", "Electronics" — the shelf the store sits on. */
  storeType: string;
  description: string;
  imageUrl: string;
  /** Wide banner for the store page hero. Falls back to imageUrl. */
  coverUrl?: string;
  rating: number;
  ratingCount: number;
  /** Quick-commerce promises one number, not a range. */
  etaMinutes: number;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold?: number;
  /** Locality within Hindaun, shown on the store row. */
  area: string;
  distanceMetres?: number;
  closesAt: string;
  isOpen: boolean;
};

export type ProductCategory = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  /** Tint behind the category image. */
  backgroundColor: string;
  productCount?: number;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type Product = {
  _id: string;
  storeId: string;
  /** Denormalised for product rails, so a card never waits on a second request. */
  storeName?: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /** Pack size as printed: "1 kg", "500 ml", "Pack of 6". */
  unit: string;
  brand?: string;
  categoryId: string;
  /** What the customer pays, in paise. */
  price: number;
  /** Printed MRP in paise. Equal to price when there is no discount. */
  mrp: number;
  rating?: number;
  ratingCount?: number;
  /** Units on the shelf. 0 renders the card as sold out. */
  stock: number;
  /** Caps the stepper, so a basket can never exceed what the shop holds. */
  maxPerOrder?: number;
  isAvailable: boolean;
  /** "Bestseller", "New", "Local favourite" — merchandising, not status. */
  tags: string[];
};
