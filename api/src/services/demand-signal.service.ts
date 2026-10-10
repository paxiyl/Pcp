import { Types } from "mongoose";

import { DemandSignalModel, DemandMode, DemandSignalDocument } from "../models/demand-signal.model";

/** Nobody is going to stock a two-letter search, and bots type junk. */
const MIN_TERM = 3;

const MAX_TERM = 80;

export type DemandSignalSummary = {
  term: string;
  mode: DemandMode;
  requests: number;
  askedCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

/** Already lower-cased by the schema; this is the guard, not the formatting. */
const usable = (term: string): string | null => {
  const clean = term.trim();

  if (clean.length < MIN_TERM || clean.length > MAX_TERM) return null;

  // A term with no letters is a stray barcode or a fat-fingered keypad, not
  // something a shop can stock.
  return /\p{L}/u.test(clean) ? clean : null;
};

/**
 * Records that a search found nothing.
 *
 * Called on the read path, so it must never make a search fail or feel slower:
 * the caller does not await it, and every error is swallowed. A lost demand
 * signal costs an insight; a thrown one costs the customer their search.
 */
export const recordMiss = async (input: {
  term: string;
  mode: DemandMode;
  /** Absent for a guest: browsing and searching do not require signing in. */
  userId?: string;
  /** True when the customer tapped "we want this", not merely searched. */
  asked?: boolean;
}): Promise<void> => {
  const term = usable(input.term);

  if (!term) return;

  const now = new Date();

  await DemandSignalModel.updateOne(
    { term, mode: input.mode },
    {
      $inc: { requests: 1, askedCount: input.asked ? 1 : 0 },
      $set: {
        lastSeenAt: now,
        ...(input.userId ? { lastUserId: new Types.ObjectId(input.userId) } : {}),
      },
      $setOnInsert: { firstSeenAt: now },
      // Asking again un-resolves it: if someone still cannot find sushi, it was
      // not actually resolved, whatever the admin ticked.
      ...(input.asked ? { $unset: { resolvedAt: 1 } } : {}),
    },
    { upsert: true },
  ).exec();
};

/** Fire-and-forget wrapper for the search path. */
export const noteMiss = (input: Parameters<typeof recordMiss>[0]): void => {
  void recordMiss(input).catch(() => undefined);
};

/**
 * What customers want that nobody lists, most wanted first.
 *
 * Terms a customer actively asked for outrank bare searches, which are noisier:
 * a tap on "we want this" is deliberate, a search may be a typo.
 */
export const listDemand = async (options?: {
  mode?: DemandMode;
  includeResolved?: boolean;
  limit?: number;
}): Promise<DemandSignalDocument[]> =>
  DemandSignalModel.find({
    ...(options?.mode ? { mode: options.mode } : {}),
    ...(options?.includeResolved ? {} : { resolvedAt: { $exists: false } }),
  })
    .sort({ askedCount: -1, requests: -1, lastSeenAt: -1 })
    .limit(Math.min(options?.limit ?? 50, 200))
    .exec();

/** Marks a term as served, or puts it back on the list. */
export const setDemandResolved = async (
  id: string,
  resolved: boolean,
): Promise<DemandSignalDocument | null> =>
  DemandSignalModel.findByIdAndUpdate(
    id,
    resolved ? { $set: { resolvedAt: new Date() } } : { $unset: { resolvedAt: 1 } },
    { new: true },
  ).exec();
