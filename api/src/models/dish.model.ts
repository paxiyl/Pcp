import { Document, model, Schema, Types } from "mongoose";
import { PRESET_KEYS } from "../config/image-presets";

/** One choice inside a group, priced as a delta from the dish's base price. */
export interface DishOption {
  _id: Types.ObjectId;
  name: string;
  /** Minor units (cents); 0 for choices that cost nothing, such as removals. */
  priceDelta: number;
  isDefault: boolean;
}

export interface DishOptionGroup {
  _id: Types.ObjectId;
  name: string;
  /** "single" renders radios, "multiple" renders checkboxes. */
  type: "single" | "multiple";
  required: boolean;
  options: DishOption[];
}

export interface DishDocument extends Document {
  _id: Types.ObjectId;
  restaurantId: Types.ObjectId;
  name: string;
  description: string;
  imageUrl: string;
  /**
   * A preset tile key, used when there is no photograph. Kept alongside
   * `imageUrl` rather than written into it: a URL is a picture of this item, a
   * preset is an admission that we do not have one, and the clients draw them
   * differently.
   */
  imagePreset?: string;
  imagePublicId?: string;
  /** Minor units (cents). */
  price: number;
  calories?: number;
  allergens: string[];
  optionGroups: DishOptionGroup[];
  /** Groups the menu list: "Popular", "Mains", "Sides", "Drinks". */
  section: string;
  isPopular: boolean;
  /**
   * Vegetarian, as the green-dot mark on an Indian menu means it. Defaults to
   * false — see the schema for why that direction and not the other.
   */
  isVeg: boolean;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const dishOptionSchema = new Schema<DishOption>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    priceDelta: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true },
);

const dishOptionGroupSchema = new Schema<DishOptionGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ["single", "multiple"], default: "single" },
    required: { type: Boolean, default: false },
    options: { type: [dishOptionSchema], default: [] },
  },
  { _id: true },
);

const dishSchema = new Schema<DishDocument>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    imageUrl: { type: String, default: "" },
    imagePreset: { type: String, enum: PRESET_KEYS },
    imagePublicId: { type: String },
    price: { type: Number, required: true, min: 0 },
    calories: { type: Number, min: 0 },
    allergens: { type: [String], default: [] },
    optionGroups: { type: [dishOptionGroupSchema], default: [] },
    section: { type: String, default: "Popular", trim: true, maxlength: 40 },
    /**
     * Declared on the interface and in the Zod schema but MISSING from this
     * one, so Mongoose silently dropped it on every write: the admin form
     * insisted on a Veg/Non-veg choice and then threw it away, which left the
     * veg-only filter and the green/brown mark reading undefined for every
     * dish in the catalogue.
     *
     * No default, deliberately. A wrong veg mark is the one mistake here a
     * customer cannot recover from, so the write has to say.
     */
    isVeg: { type: Boolean, required: true },
    isPopular: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: true },
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

export const DishModel = model<DishDocument>("Dish", dishSchema);
