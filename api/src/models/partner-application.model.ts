import { Document, Schema, Types, model } from "mongoose";

/** What someone is asking to become. Admin is never applied for. */
export const PARTNER_ROLES = ["store_owner", "restaurant_owner", "driver"] as const;

export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface PartnerApplicationDocument extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  requestedRole: PartnerRole;
  status: ApplicationStatus;
  /** Shop or kitchen name. The venue is created from this on approval. */
  businessName?: string;
  /** Locality within Hindaun. */
  area?: string;
  phone: string;
  /** Drivers only. */
  vehicle?: string;
  /** Anything the applicant wants the admin to know. */
  note?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  /** The admin's reason, shown back to the applicant on a rejection. */
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A request to become a shopkeeper, a restaurant or a rider.
 *
 * Kept as its own record rather than a flag on the user because a decision has
 * a history: who asked, what they said, who decided and why. A rejected
 * applicant can be told the reason, and a second application does not erase
 * the first.
 *
 * Nobody is granted a role by applying. Approval is the only thing that moves
 * a role, and only an admin can approve.
 */
const partnerApplicationSchema = new Schema<PartnerApplicationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedRole: { type: String, enum: PARTNER_ROLES, required: true, index: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: "pending", index: true },
    businessName: { type: String, trim: true, maxlength: 80 },
    area: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    vehicle: { type: String, trim: true, maxlength: 60 },
    note: { type: String, trim: true, maxlength: 500 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

// One open application per person: re-applying while a decision is outstanding
// would give an admin two records saying the same thing.
partnerApplicationSchema.index(
  { userId: 1 },
  { partialFilterExpression: { status: "pending" }, unique: true },
);

export const PartnerApplicationModel = model<PartnerApplicationDocument>(
  "PartnerApplication",
  partnerApplicationSchema,
);
