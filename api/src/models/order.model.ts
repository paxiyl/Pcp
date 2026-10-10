import { Document, model, Schema, Types } from "mongoose";

import { notifyOrderStatus } from "../services/notification.service";
import { VendorKind } from "./basket.model";

/**
 * UPI first: it is how most of Hindaun will actually pay. `cod` is listed as a
 * method because that is how the customer experiences it, even though no
 * gateway is involved.
 */
export const PAYMENT_METHODS = ["upi", "card", "netbanking", "wallet", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** "cod" is a provider in the sense that it owns the settlement path: the rider. */
export const PAYMENT_PROVIDERS = ["razorpay", "stripe", "cod"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/**
 * The lifecycle a customer can see. `pending_payment` exists only between
 * creating the order and Stripe confirming it; nothing is sent to a kitchen
 * until the webhook moves it to `confirmed`.
 */
export const ORDER_STATUSES = [
  "pending_payment",
  "payment_failed",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  _id: Types.ObjectId;
  /** Set on a restaurant line. Exactly one of dishId/productId is present. */
  dishId?: Types.ObjectId;
  /** Set on a store line. */
  productId?: Types.ObjectId;
  name: string;
  imageUrl: string;
  /** Copied with the image: a line with neither would draw blank. */
  imagePreset?: string;
  unitPrice: number;
  quantity: number;
  optionIds: Types.ObjectId[];
  optionNames: string[];
  note?: string;
}

/** Plain lat/lng: this is a snapshot for display, not a queryable geo index. */
export type OrderPoint = { lat: number; lng: number };

/** Filled in when a rider accepts the order; absent until then. */
export interface OrderDriver {
  driverId?: Types.ObjectId;
  name: string;
  phone?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  /** Last reported position, updated by the driver app. */
  location?: OrderPoint;
  locationUpdatedAt?: Date;
}

/** Rider pay, snapshotted when the delivery is claimed so it cannot drift. */
export interface OrderDriverPayout {
  base: number;
  distance: number;
  total: number;
  distanceKm: number;
}

export interface OrderStatusEntry {
  _id: Types.ObjectId;
  status: OrderStatus;
  at: Date;
  note?: string;
}

export interface OrderDocument extends Document {
  _id: Types.ObjectId;
  /** Short human reference shown to the customer, e.g. CH-2481. */
  reference: string;
  userId: Types.ObjectId;
  /**
   * Which catalogue the order came from. The `restaurant*` fields below are the
   * denormalised VENDOR snapshot for both kinds — a store order fills them with
   * the store's name, image and address. The names are historical: renaming them
   * would touch the admin dashboard, the driver app and every order screen for no
   * behavioural gain, so the meaning is widened here instead.
   */
  vendorKind: VendorKind;
  /** Set when vendorKind is "restaurant". */
  restaurantId?: Types.ObjectId;
  /** Set when vendorKind is "store". */
  storeId?: Types.ObjectId;
  restaurantName: string;
  restaurantImageUrl: string;
  restaurantAddress: string;
  items: Types.DocumentArray<OrderItem & Document>;
  // Money is stored in minor units and snapshotted, so a later price change
  // never rewrites an order the customer already paid for.
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  currency: string;
  /** Platform's cut of the subtotal, and what the restaurant is owed after it. */
  commission: number;
  commissionRate: number;
  restaurantPayout: number;

  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    instructions?: string;
  };
  contactName: string;
  contactPhone?: string;

  restaurantLocation?: OrderPoint;
  deliveryLocation?: OrderPoint;
  driver?: OrderDriver;
  driverPayout?: OrderDriverPayout;

  includeCutlery: boolean;
  orderNote?: string;

  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  /** Best estimate at the time of ordering; tracking refines it later. */
  estimatedDeliveryAt: Date;

  status: OrderStatus;
  statusHistory: Types.DocumentArray<OrderStatusEntry & Document>;

  /**
   * Handed over at the door. Never selected by default, so the rider's own
   * endpoints cannot read the code they are supposed to be told out loud.
   */
  deliveryCode: string;

  /**
   * How the customer chose to pay. `cod` is not a gateway at all — no provider
   * is contacted, and the money is collected at the door by the rider.
   */
  paymentMethod: PaymentMethod;
  paymentProvider: PaymentProvider;
  /** Razorpay order id (`order_...`). Unused by Stripe, which has no equivalent. */
  providerOrderId?: string;
  /**
   * The provider's PAYMENT identifier: a Stripe PaymentIntent (`pi_...`) or a
   * Razorpay payment (`pay_...`). The field name is historical — it predates
   * Razorpay and renaming it would touch the admin, driver app and every order
   * screen for no behavioural gain.
   */
  paymentIntentId?: string;
  paidAt?: Date;

  /** Cash still to collect at the door, in paise. 0 once settled, unset for prepaid. */
  codAmountDue?: number;
  codCollectedAt?: Date;

  /** How much has been refunded, in paise. Supports partial refunds. */
  refundedAmount?: number;
  refundedAt?: Date;
  /** The gateway's refund id, so a support query can be traced end to end. */
  refundId?: string;
  refundReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItem & Document>(
  {
    // No longer required: a store line references a product instead.
    dishId: { type: Schema.Types.ObjectId, ref: "Dish" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    imageUrl: { type: String, default: "" },
    imagePreset: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    optionIds: { type: [Schema.Types.ObjectId], default: [] },
    optionNames: { type: [String], default: [] },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true },
);

const statusEntrySchema = new Schema<OrderStatusEntry & Document>(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true },
);

const pointSchema = new Schema<OrderPoint>(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const driverSchema = new Schema<OrderDriver>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 32 },
    avatarUrl: { type: String, default: "" },
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, min: 0 },
    location: { type: pointSchema, default: undefined },
    locationUpdatedAt: { type: Date },
  },
  { _id: false },
);

const payoutSchema = new Schema<OrderDriverPayout>(
  {
    base: { type: Number, required: true, min: 0 },
    distance: { type: Number, required: true, min: 0 },
    distanceKm: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDocument>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Defaults to "restaurant" so orders placed before stores existed read back
    // correctly without a migration.
    vendorKind: {
      type: String,
      enum: ["restaurant", "store"],
      default: "restaurant",
      required: true,
      index: true,
    },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", index: true },
    restaurantName: { type: String, required: true, trim: true, maxlength: 80 },
    restaurantImageUrl: { type: String, default: "" },
    restaurantAddress: { type: String, default: "", trim: true, maxlength: 200 },

    items: { type: [orderItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0 },
    serviceFee: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "usd", lowercase: true, maxlength: 3 },
    commission: { type: Number, default: 0, min: 0 },
    commissionRate: { type: Number, default: 0, min: 0, max: 0.5 },
    restaurantPayout: { type: Number, default: 0, min: 0 },

    deliveryAddress: {
      line1: { type: String, required: true, trim: true, maxlength: 120 },
      line2: { type: String, trim: true, maxlength: 120 },
      city: { type: String, required: true, trim: true, maxlength: 80 },
      postcode: { type: String, required: true, trim: true, maxlength: 16 },
      instructions: { type: String, trim: true, maxlength: 200 },
    },
    contactName: { type: String, required: true, trim: true, maxlength: 80 },
    contactPhone: { type: String, trim: true, maxlength: 32 },

    restaurantLocation: { type: pointSchema, default: undefined },
    deliveryLocation: { type: pointSchema, default: undefined },
    driver: { type: driverSchema, default: undefined },
    driverPayout: { type: payoutSchema, default: undefined },

    includeCutlery: { type: Boolean, default: false },
    orderNote: { type: String, trim: true, maxlength: 300 },

    prepTimeMinMinutes: { type: Number, default: 20, min: 0 },
    prepTimeMaxMinutes: { type: Number, default: 30, min: 0 },
    estimatedDeliveryAt: { type: Date, required: true },

    status: { type: String, enum: ORDER_STATUSES, default: "pending_payment", index: true },
    statusHistory: { type: [statusEntrySchema], default: [] },

    deliveryCode: { type: String, required: true, select: false },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "card", index: true },
    paymentProvider: { type: String, enum: PAYMENT_PROVIDERS, default: "razorpay" },
    // Sparse: an order only has these once a gateway payment has been started,
    // and a COD order never gets them at all.
    providerOrderId: { type: String, index: true, sparse: true },
    paymentIntentId: { type: String, index: true, sparse: true },
    paidAt: { type: Date },

    codAmountDue: { type: Number, min: 0 },
    codCollectedAt: { type: Date },

    refundedAmount: { type: Number, min: 0 },
    refundedAt: { type: Date },
    refundId: { type: String, index: true, sparse: true },
    refundReason: { type: String, trim: true, maxlength: 200 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, record) => {
        const { __v, ...safe } = record as Record<string, unknown>;
        return safe;
      },
    },
  },
);

orderSchema.index({ userId: 1, createdAt: -1 });

/**
 * `restaurantId` was `required: true`. It cannot stay that way now an order may
 * belong to a store, so the invariant moves here rather than disappearing.
 */
orderSchema.pre("validate", function requireMatchingVendor() {
  const hasRestaurant = Boolean(this.restaurantId);
  const hasStore = Boolean(this.storeId);

  if (hasRestaurant === hasStore) {
    throw new Error("An order must reference exactly one restaurant or one store");
  }
});

/**
 * Notify on every status change, from one place.
 *
 * There are nine sites that move an order's status across four services, and
 * a tenth will be written eventually. Wiring each one by hand means the day
 * someone adds a new transition, the customer silently stops being told. A
 * hook cannot be forgotten.
 *
 * isModified is only readable BEFORE the save completes, so the pre hook
 * records it and the post hook acts on it.
 */
orderSchema.pre("save", function markStatusChange() {
  this.$locals.statusChanged = this.isModified("status");
});

orderSchema.post("save", function notifyOnStatusChange(doc: OrderDocument) {
  if (!doc.$locals.statusChanged) return;

  // Deliberately not awaited: the order is already saved, and a slow or failed
  // notification must not hold up the response or fail the request. The
  // service swallows its own errors.
  void notifyOrderStatus(doc);
});

export const OrderModel = model<OrderDocument>("Order", orderSchema);
