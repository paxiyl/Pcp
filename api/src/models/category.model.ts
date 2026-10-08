import { Document, model, Schema, Types } from "mongoose";

export interface CategoryDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  imageUrl: string;
  imagePublicId?: string;
  /** Tint behind the category image on the home strip, e.g. "#FFE9D6". */
  backgroundColor: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String },
    backgroundColor: { type: String, default: "#F3F6F5" },
    sortOrder: { type: Number, default: 0, index: true },
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

export const CategoryModel = model<CategoryDocument>("Category", categorySchema);
