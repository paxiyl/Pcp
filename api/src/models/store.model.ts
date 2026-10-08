import { Document, model, Schema, Types } from "mongoose";

/**
 * A shop in Hindaun: kirana, chemist, dairy, bakery, electronics, stationery.
 *
 * Deliberately shaped like `restaurant.model.ts` rather than sharing a base with
 * it. The two have the same fee and opening-hours vocabulary but diverge where it
 * matters — a store promises a single ETA, carries a `storeType` rather than
 * cuisines, and sells packaged SKUs with an MRP. Merging them would mean a model
 * where half the fields are null for half the rows.
 */
export interface StoreDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  /** "Kirana", "Chemist", "Dairy", "Electronics" — the shelf the store sits on. */
  storeType: string;
  description: string;
  imageUrl: string;
  imagePublicId?: string;
  /** Wide banner for the store page hero. Falls back to imageUrl when empty. */
  coverUrl: string;
  coverPublicId?: string;
  categories: Types.ObjectId[];
  /** Admin-entered, not customer reviews — same policy as restaurants. */
  rating: number;
  ratingCount: number;
  /**
   * Quick-commerce promises one number, not a range. Stored as a single value so
   * no screen has to decide which end of a range to show.
   */
  etaMinutes: number;
  /** Negotiated commission for this store; falls back to the platform rate. */
  commissionRate?: number;
  /** Money is stored in minor units (paise) everywhere. */
  deliveryFee: number;
  minOrder: number;
  /** Spend this much (paise) and delivery is free; null when never free. */
  freeDeliveryThreshold?: number;
  address: string;
  /** Locality within Hindaun, shown on the store row: "Katkad Road", "Bazaar". */
  area: string;
  location?: { type: "Point"; coordinates: [number, number] };
  /** 24-hour "HH:mm", rendered as "Closes 10:30 PM". */
  closesAt: string;
  isOpen: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<StoreDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    storeType: { type: String, default: "Kirana", trim: true, maxlength: 40, index: true },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String },
    coverUrl: { type: String, default: "" },
    coverPublicId: { type: String },
    categories: [{ type: Schema.Types.ObjectId, ref: "ProductCategory", index: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    etaMinutes: { type: Number, default: 20, min: 1, max: 240 },
    commissionRate: { type: Number, min: 0, max: 0.5 },
    // Matches SETTINGS_DEFAULTS.driverBasePay, so a store that never sets a fee
    // still covers the rider's base pay rather than costing money per order.
    deliveryFee: { type: Number, default: 2500, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    freeDeliveryThreshold: { type: Number, min: 0 },
    address: { type: String, default: "", trim: true, maxlength: 200 },
    area: { type: String, default: "", trim: true, maxlength: 80, index: true },
    location: {
      type: { type: String, enum: ["Point"], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    closesAt: { type: String, default: "22:00" },
    isOpen: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
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

storeSchema.index({ location: "2dsphere" });
storeSchema.index({ name: "text", storeType: "text", area: "text" });

export const StoreModel = model<StoreDocument>("Store", storeSchema);
