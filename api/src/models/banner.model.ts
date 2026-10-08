import { Document, model, Schema, Types } from "mongoose";

export interface BannerDocument extends Document {
  _id: Types.ObjectId;
  title: string;
  subtitle: string;
  imageUrl: string;
  imagePublicId?: string;
  /**
   * Where tapping the banner takes the customer: a category slug the home
   * screen can filter by. Empty means the banner is artwork only.
   */
  categorySlug?: string;
  /** Both optional: a banner with no window runs as soon as it is active. */
  startsAt?: Date;
  endsAt?: Date;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<BannerDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    subtitle: { type: String, default: "", trim: true, maxlength: 120 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String },
    categorySlug: { type: String, trim: true, lowercase: true, maxlength: 40 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
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

export const BannerModel = model<BannerDocument>("Banner", bannerSchema);
