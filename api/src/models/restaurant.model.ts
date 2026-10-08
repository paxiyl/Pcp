import { Document, model, Schema, Types } from "mongoose";

export interface RestaurantDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imagePublicId?: string;
  cuisines: string[];
  categories: Types.ObjectId[];
  /** Admin-entered, not customer reviews. */
  rating: number;
  ratingCount: number;
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  /** Negotiated commission for this restaurant; falls back to the platform rate. */
  commissionRate?: number;
  /** Money is stored in minor units (cents) everywhere. */
  deliveryFee: number;
  minOrder: number;
  /** Spend this much (cents) and delivery is free; null when never free. */
  freeDeliveryThreshold?: number;
  address: string;
  location?: { type: "Point"; coordinates: [number, number] };
  /** 24-hour "HH:mm", rendered as "Closes 10:30 PM". */
  closesAt: string;
  isOpen: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSchema = new Schema<RestaurantDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, default: "", trim: true, maxlength: 400 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String },
    cuisines: { type: [String], default: [] },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category", index: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    prepTimeMinMinutes: { type: Number, default: 20, min: 0 },
    prepTimeMaxMinutes: { type: Number, default: 30, min: 0 },
    commissionRate: { type: Number, min: 0, max: 0.5 },
    // Matches SETTINGS_DEFAULTS.driverBasePay: a restaurant that never sets a
    // fee still covers the rider's base pay rather than costing money per order.
    deliveryFee: { type: Number, default: 490, min: 0 },
    minOrder: { type: Number, default: 0, min: 0 },
    freeDeliveryThreshold: { type: Number, min: 0 },
    address: { type: String, default: "", trim: true, maxlength: 200 },
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

restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ name: "text", cuisines: "text" });

export const RestaurantModel = model<RestaurantDocument>("Restaurant", restaurantSchema);
