import { Document, Schema, Types, model } from "mongoose";

/** Which half of the app the customer was looking in when they came up empty. */
export const DEMAND_MODES = ["grocery", "food"] as const;

export type DemandMode = (typeof DEMAND_MODES)[number];

export interface DemandSignalDocument extends Document {
  _id: Types.ObjectId;
  /** Lower-cased and trimmed, so "Sushi" and "sushi " are the same demand. */
  term: string;
  mode: DemandMode;
  /** How many people have asked for this. */
  requests: number;
  /** Set when a customer taps through from the empty state, not on every miss. */
  askedCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** The most recent person who asked, so the operator can tell them it landed. */
  lastUserId?: Types.ObjectId;
  /** Cleared by an admin once something matching it is listed. */
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What people looked for and we could not sell them.
 *
 * A new marketplace's most valuable data is the search that returned nothing:
 * it is a customer telling you exactly what to stock, unprompted. Throwing that
 * away and showing an apology is the whole mistake — so every empty search is
 * counted here, and the ones a customer actively asks for are counted twice
 * over in `askedCount`, because tapping "we want this" is a stronger signal
 * than a search that may have been a typo.
 *
 * Deliberately not tied to a user: the count matters, and a customer who
 * searches for the same thing on Monday and Friday wanted it both times.
 */
const demandSignalSchema = new Schema<DemandSignalDocument>(
  {
    term: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    mode: { type: String, enum: DEMAND_MODES, required: true },
    requests: { type: Number, default: 1, min: 0 },
    askedCount: { type: Number, default: 0, min: 0 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    lastUserId: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

// One row per term per catalogue: "sushi" wanted in food mode is a different
// thing to stock from "sushi" wanted in groceries.
demandSignalSchema.index({ term: 1, mode: 1 }, { unique: true });

// The admin list is "what is most wanted, still unlisted".
demandSignalSchema.index({ resolvedAt: 1, requests: -1 });

export const DemandSignalModel = model<DemandSignalDocument>("DemandSignal", demandSignalSchema);
