import { Document, Schema, Types, model } from "mongoose";

/** Who is being settled with. */
export const SETTLEMENT_PARTIES = ["rider", "store", "restaurant"] as const;

export type SettlementParty = (typeof SETTLEMENT_PARTIES)[number];

/** Which way the money moves, from the business's point of view. */
export const SETTLEMENT_DIRECTIONS = ["incoming", "outgoing"] as const;

export type SettlementDirection = (typeof SETTLEMENT_DIRECTIONS)[number];

export interface SettlementDocument extends Document {
  _id: Types.ObjectId;
  party: SettlementParty;
  /** Exactly one of these is set, matching `party`. */
  riderId?: Types.ObjectId;
  storeId?: Types.ObjectId;
  restaurantId?: Types.ObjectId;
  /** Denormalised so a settled run still reads correctly if the shop is renamed. */
  partyName: string;
  /**
   * The orders this run covers, by id. Stored rather than recomputed from a
   * date range: a range re-run tomorrow would quietly include orders that
   * arrived in between, and a settlement has to mean the same thing forever.
   */
  orderIds: Types.ObjectId[];
  orderCount: number;
  /** Rider runs: what they took in cash at doors. */
  cashCollected: number;
  /** Rider runs: what they earned on those deliveries. */
  riderEarnings: number;
  /** Vendor runs: goods value before our cut. */
  goodsValue: number;
  /** Vendor runs: our cut of those goods. */
  commission: number;
  /** Always positive. `direction` says which way it went. */
  amount: number;
  direction: SettlementDirection;
  note?: string;
  settledBy: Types.ObjectId;
  settledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One settlement run: money that actually changed hands, and the orders it
 * covered.
 *
 * This is the record that makes cash on delivery work. A rider who collects
 * ₹500 at a door is holding money that belongs to three parties at once — the
 * shop's goods, our commission and fees, and their own earnings — and the only
 * way to know who is square with whom is to write down what was handed over
 * and against which orders.
 *
 * Immutable by intent: an incorrect run is corrected by settling again, never
 * by editing history. There is no update path in the service.
 */
const settlementSchema = new Schema<SettlementDocument>(
  {
    party: { type: String, enum: SETTLEMENT_PARTIES, required: true, index: true },
    riderId: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store", index: true, sparse: true },
    restaurantId: { type: Schema.Types.ObjectId, ref: "Restaurant", index: true, sparse: true },
    partyName: { type: String, required: true, trim: true, maxlength: 120 },
    orderIds: { type: [Schema.Types.ObjectId], ref: "Order", default: [] },
    orderCount: { type: Number, required: true, min: 0 },
    cashCollected: { type: Number, default: 0, min: 0 },
    riderEarnings: { type: Number, default: 0, min: 0 },
    goodsValue: { type: Number, default: 0, min: 0 },
    commission: { type: Number, default: 0, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    direction: { type: String, enum: SETTLEMENT_DIRECTIONS, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    settledBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    settledAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// The history list, newest first, optionally filtered to one party.
settlementSchema.index({ party: 1, settledAt: -1 });

export const SettlementModel = model<SettlementDocument>("Settlement", settlementSchema);
