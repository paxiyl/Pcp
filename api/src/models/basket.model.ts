import { Document, model, Schema, Types } from "mongoose";

/** Which catalogue the basket is drawing from. */
export type VendorKind = "restaurant" | "store";

export interface BasketItem {
  _id: Types.ObjectId;
  /** Set for a restaurant line. Exactly one of dishId/productId is present. */
  dishId?: Types.ObjectId;
  /** Set for a store line. */
  productId?: Types.ObjectId;
  /**
   * The vendor this specific line came from.
   *
   * Today it always equals the basket's own vendor, because the service enforces
   * one vendor per basket. It is stored per line anyway so that lifting that rule
   * later is an additive change — drop the check in the service and split the
   * order by this field — rather than a migration of every open basket.
   */
  storeId?: Types.ObjectId;
  restaurantId?: Types.ObjectId;
  name: string;
  imageUrl: string;
  /** Copied with the image: a line with neither would draw blank. */
  imagePreset?: string;
  /** Minor units (paise), priced by the server. Never taken from the client. */
  unitPrice: number;
  /** Printed MRP at the time of adding, for the struck-through price. Store lines only. */
  mrp?: number;
  /** Pack size as printed: "1 kg", "500 ml". Store lines only. */
  unit?: string;
  quantity: number;
  optionIds: Types.ObjectId[];
  optionNames: string[];
  note?: string;
}

export interface BasketDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  vendorKind: VendorKind;
  /** Set when vendorKind is "restaurant". */
  restaurantId?: Types.ObjectId;
  /** Set when vendorKind is "store". */
  storeId?: Types.ObjectId;
  items: BasketItem[];
  includeCutlery: boolean;
  orderNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const basketItemSchema = new Schema<BasketItem>(
  {
    dishId: { type: Schema.Types.ObjectId, ref: "Dish" },
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
    storeId: { type: Schema.Types.ObjectId, ref: "Store" },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    name: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    imagePreset: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    unit: { type: String, trim: true, maxlength: 40 },
    quantity: { type: Number, required: true, min: 1 },
    optionIds: [{ type: Schema.Types.ObjectId }],
    optionNames: { type: [String], default: [] },
    note: { type: String, trim: true, maxlength: 200 },
  },
  { _id: true },
);

const basketSchema = new Schema<BasketDocument>(
  {
    // One open basket per customer; ordering from another vendor replaces it.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    // Defaults to "restaurant" so baskets written before stores existed read back
    // correctly without a migration.
    vendorKind: {
      type: String,
      enum: ["restaurant", "store"],
      default: "restaurant",
      required: true,
    },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant" },
    storeId: { type: Schema.Types.ObjectId, ref: "Store" },
    items: { type: [basketItemSchema], default: [] },
    includeCutlery: { type: Boolean, default: false },
    orderNote: { type: String, default: "", trim: true, maxlength: 300 },
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

/**
 * `restaurantId` used to be `required: true`. It cannot stay that way now that a
 * basket may belong to a store instead, so the invariant moves here: exactly one
 * vendor reference, and it must match the declared kind. Enforced at the model so
 * no service path can write a basket that belongs to nothing.
 */
basketSchema.pre("validate", function requireMatchingVendor() {
  const hasRestaurant = Boolean(this.restaurantId);
  const hasStore = Boolean(this.storeId);

  if (hasRestaurant === hasStore) {
    throw new Error("A basket must reference exactly one restaurant or one store");
  }

  if (this.vendorKind === "restaurant" && !hasRestaurant) {
    throw new Error("A restaurant basket must reference a restaurant");
  }

  if (this.vendorKind === "store" && !hasStore) {
    throw new Error("A store basket must reference a store");
  }
});

export const BasketModel = model<BasketDocument>("Basket", basketSchema);
