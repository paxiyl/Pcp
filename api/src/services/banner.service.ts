import mongoose from "mongoose";

import { BannerDocument, BannerModel } from "../models/banner.model";
import { BannerState } from "../types/banner.types";
import { NotFoundException } from "../utils/app-error";
import {
  BannerInput,
  BannerReorderInput,
  BannerUpdateInput,
} from "../validators/banner.validator";

export const bannerState = (banner: BannerDocument, now = new Date()): BannerState => {
  if (!banner.isActive) return "draft";
  if (banner.startsAt && banner.startsAt > now) return "scheduled";
  if (banner.endsAt && banner.endsAt < now) return "expired";

  return "active";
};

/**
 * What the customer app shows: switched on and inside its window, in display
 * order. A banner with no dates runs until someone turns it off.
 */
export const listActiveBanners = (): Promise<BannerDocument[]> => {
  const now = new Date();

  return BannerModel.find({
    isActive: true,
    $and: [
      { $or: [{ startsAt: mongoose.trusted({ $exists: false }) }, { startsAt: mongoose.trusted({ $lte: now }) }] },
      { $or: [{ endsAt: mongoose.trusted({ $exists: false }) }, { endsAt: mongoose.trusted({ $gte: now }) }] },
    ],
  })
    .sort({ sortOrder: 1, createdAt: 1 })
    .exec();
};

export const listAllBanners = (): Promise<BannerDocument[]> =>
  BannerModel.find().sort({ sortOrder: 1, createdAt: 1 }).exec();

export const createBanner = async (input: BannerInput): Promise<BannerDocument> => {
  // New banners go to the end of the row rather than jumping the queue.
  const last = await BannerModel.findOne().sort({ sortOrder: -1 }).exec();

  return BannerModel.create({
    categorySlug: input.categorySlug,
    endsAt: input.endsAt ?? undefined,
    imagePublicId: input.imagePublicId,
    imageUrl: input.imageUrl,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? (last?.sortOrder ?? 0) + 1,
    startsAt: input.startsAt ?? undefined,
    subtitle: input.subtitle,
    title: input.title,
  });
};

/** Only the keys the caller sent are written; a null date clears that date. */
export const updateBanner = async (
  bannerId: string,
  input: BannerUpdateInput,
): Promise<BannerDocument> => {
  const changes: Record<string, unknown> = {};
  const cleared: Record<string, "" | 1> = {};

  for (const key of [
    "categorySlug",
    "imagePublicId",
    "imageUrl",
    "isActive",
    "sortOrder",
    "subtitle",
    "title",
  ] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }

  for (const key of ["startsAt", "endsAt"] as const) {
    if (input[key] === undefined) continue;
    if (input[key] === null) cleared[key] = 1;
    else changes[key] = input[key];
  }

  const banner = await BannerModel.findByIdAndUpdate(
    bannerId,
    {
      $set: changes,
      ...(Object.keys(cleared).length > 0 ? { $unset: cleared } : {}),
    },
    { returnDocument: "after" },
  ).exec();

  if (!banner) throw new NotFoundException("Banner not found");

  return banner;
};

export const deleteBanner = async (bannerId: string): Promise<void> => {
  const banner = await BannerModel.findByIdAndDelete(bannerId).exec();

  if (!banner) throw new NotFoundException("Banner not found");
};

/** One write per moved row, sent as a single batch so the order never tears. */
export const reorderBanners = async (input: BannerReorderInput): Promise<void> => {
  await BannerModel.bulkWrite(
    input.banners.map(({ id, sortOrder }) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder } } },
    })),
  );
};
