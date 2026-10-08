import { Document, model, Schema, Types } from "mongoose";

/**
 * The product taxonomy, two levels deep: "Staples" -> "Atta & Flour".
 *
 * Separate from `category.model.ts`, which is the restaurant/cuisine taxonomy and
 * is wired into the admin's drag-and-drop ordering. Keeping them apart means the
 * grocery tree can grow sub-categories without touching a screen that already
 * works.
 */
export interface ProductCategoryDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  imageUrl: string;
  imagePublicId?: string;
  /** Tint behind the category image on the home strip. */
  backgroundColor: string;
  /** null for a top-level category; set for a sub-category. */
  parentId?: Types.ObjectId | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productCategorySchema = new Schema<ProductCategoryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String },
    backgroundColor: { type: String, default: "#E8F6EC", trim: true },
    // Self-reference, so the tree needs no second collection.
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "ProductCategory",
      default: null,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
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

export const ProductCategoryModel = model<ProductCategoryDocument>(
  "ProductCategory",
  productCategorySchema,
);
