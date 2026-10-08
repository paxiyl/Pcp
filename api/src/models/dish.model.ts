import { Document, model, Schema, Types } from "mongoose";

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
  imagePublicId?: string;
  /** Minor units (cents). */
  price: number;
  calories?: number;
  allergens: string[];
  optionGroups: DishOptionGroup[];
  /** Groups the menu list: "Popular", "Mains", "Sides", "Drinks". */
  section: string;
  isPopular: boolean;
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
    imagePublicId: { type: String },
    price: { type: Number, required: true, min: 0 },
    calories: { type: Number, min: 0 },
    allergens: { type: [String], default: [] },
    optionGroups: { type: [dishOptionGroupSchema], default: [] },
    section: { type: String, default: "Popular", trim: true, maxlength: 40 },
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
