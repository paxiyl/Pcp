import { Document, model, Schema, Types } from "mongoose";

import { compareValue, hashValue } from "../utils/bcrypt";

/**
 * One account has exactly one role, decided by the server.
 *
 * The app offers a role picker at sign-in, but that only chooses which EXPERIENCE
 * to open — it never grants anything. A picker that could hand out a role would
 * be an authorisation hole with a dropdown in front of it.
 *
 * "admin" is included here because the backoffice shares this user collection,
 * but admins sign in on the separate web app, never in the mobile app.
 */
export const USER_ROLES = ["customer", "driver", "store_owner", "restaurant_owner", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DRIVER_STATUSES = ["pending", "approved", "suspended"] as const;

export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  /**
   * The shop this account manages. Required in practice for a store_owner and
   * meaningless for everyone else, so it is enforced in the service rather than
   * with a schema `required`, which would block creating the owner first.
   */
  storeId?: Types.ObjectId;
  /** Set on a restaurant_owner. The counterpart of storeId. */
  restaurantId?: Types.ObjectId;
  isActive: boolean;
  /** Drivers only: whether they are accepting deliveries right now. */
  isOnline: boolean;
  /** Drivers only: an admin decision. Only "approved" may work the queue. */
  driverStatus?: DriverStatus;
  /** Drivers only: shown to the customer on the tracking screen. */
  rating?: number;
  ratingCount?: number;
  /** Server-owned link to the Stripe customer; never supplied by a client. */
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword: (candidate: string) => Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Never returned by default; ask for it explicitly when verifying a login.
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true, maxlength: 32 },
    role: { type: String, enum: USER_ROLES, default: "customer", index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", index: true, sparse: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", index: true, sparse: true },
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },
    // Someone who signs up as a rider waits for an admin; an admin who creates
    // the account approves it in the same step.
    driverStatus: { type: String, enum: DRIVER_STATUSES, default: "pending", index: true },
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, min: 0 },
    stripeCustomerId: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_document, record) => {
        const { __v, password, stripeCustomerId, ...safe } = record as Record<string, unknown>;

        return safe;
      },
    },
  },
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await hashValue(this.password);
});

userSchema.methods.comparePassword = function comparePassword(candidate: string) {
  return compareValue(candidate, this.password);
};

export const UserModel = model<UserDocument>("User", userSchema);
