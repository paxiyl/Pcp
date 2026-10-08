import { Document, model, Schema, Types } from "mongoose";

export const ADDRESS_LABELS = ["Home", "Work", "Other"] as const;

export type AddressLabel = (typeof ADDRESS_LABELS)[number];

export interface UserAddressDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  label: AddressLabel;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  instructions?: string;
  location?: { type: "Point"; coordinates: [number, number] };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userAddressSchema = new Schema<UserAddressDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: { type: String, enum: ADDRESS_LABELS, default: "Home" },
    line1: { type: String, required: true, trim: true, maxlength: 120 },
    line2: { type: String, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    postcode: { type: String, required: true, trim: true, maxlength: 16 },
    instructions: { type: String, trim: true, maxlength: 200 },
    location: {
      // GeoJSON [longitude, latitude], ready for delivery-radius queries later.
      type: {
        type: String,
        enum: ["Point"],
        default: undefined,
      },
      coordinates: { type: [Number], default: undefined },
    },
    isDefault: { type: Boolean, default: false },
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

userAddressSchema.index({ location: "2dsphere" });

export const UserAddressModel = model<UserAddressDocument>(
  "UserAddress",
  userAddressSchema,
);
