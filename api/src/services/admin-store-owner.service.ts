import mongoose from "mongoose";

import { StoreModel } from "../models/store.model";
import { UserDocument, UserModel } from "../models/user.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  CreateStoreOwnerInput,
  StoreOwnerQuery,
  UpdateStoreOwnerInput,
} from "../validators/admin-store-owner.validator";

/**
 * Store-owner accounts, from the backoffice.
 *
 * Until this existed, attaching a shopkeeper to a shop needed a direct database
 * write, which is not an onboarding process — it is a reason not to onboard
 * anyone.
 */

export type StoreOwnerRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  /** The shop they run. Null when an account was created before being linked. */
  store: { _id: string; name: string; slug: string } | null;
};

const toRow = (
  owner: UserDocument & { storeId?: { _id: unknown; name: string; slug: string } | null },
): StoreOwnerRow => ({
  _id: owner._id.toString(),
  createdAt: owner.createdAt,
  email: owner.email,
  isActive: owner.isActive,
  name: owner.name,
  phone: owner.phone,
  store:
    owner.storeId && typeof owner.storeId === "object" && "name" in owner.storeId
      ? {
          _id: String((owner.storeId as { _id: unknown })._id),
          name: owner.storeId.name,
          slug: owner.storeId.slug,
        }
      : null,
});

export const listStoreOwners = async (
  query: StoreOwnerQuery,
): Promise<{ owners: StoreOwnerRow[]; total: number }> => {
  const filter: Record<string, unknown> = { role: "store_owner" };

  if (query.search) {
    // Escaped so a search term can never smuggle in regex syntax, and marked
    // trusted because `sanitizeFilter` would otherwise cast the operator away.
    const matches = mongoose.trusted({
      $options: "i",
      $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    });

    filter.$or = [{ name: matches }, { email: matches }];
  }

  const [owners, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("storeId", "name slug")
      .exec(),
    UserModel.countDocuments(filter).exec(),
  ]);

  return { owners: owners.map((owner) => toRow(owner as never)), total };
};

/**
 * One shop, one owner account.
 *
 * Enforced because two accounts on the same shop means two people toggling the
 * counter open and closed against each other, with no record of who did what.
 * Shared staff logins need a proper staff model, not a second owner.
 */
const assertStoreUnclaimed = async (storeId: string, exceptOwnerId?: string) => {
  const store = await StoreModel.findById(storeId).select("_id name").exec();

  if (!store) throw new NotFoundException("Store not found");

  const claimed = await UserModel.findOne({
    _id: exceptOwnerId ? mongoose.trusted({ $ne: exceptOwnerId }) : mongoose.trusted({ $exists: true }),
    role: "store_owner",
    storeId: store._id,
  })
    .select("name")
    .exec();

  if (claimed) {
    throw new BadRequestException(`${store.name} is already managed by ${claimed.name}`);
  }

  return store;
};

export const createStoreOwner = async (input: CreateStoreOwnerInput): Promise<StoreOwnerRow> => {
  const existing = await UserModel.findOne({ email: input.email }).select("_id").exec();

  if (existing) throw new BadRequestException("That email is already registered");

  await assertStoreUnclaimed(input.storeId);

  const owner = await UserModel.create({
    email: input.email,
    isActive: true,
    name: input.name,
    // Hashed by the model's pre-save hook, same as every other account.
    password: input.password,
    phone: input.phone,
    role: "store_owner",
    storeId: input.storeId,
  });

  await owner.populate("storeId", "name slug");

  return toRow(owner as never);
};

export const updateStoreOwner = async (
  ownerId: string,
  input: UpdateStoreOwnerInput,
): Promise<StoreOwnerRow> => {
  const changes: Record<string, unknown> = {};

  for (const key of ["name", "phone", "isActive"] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }

  // Moving an owner to a different shop is a real operation — a shop changes
  // hands — so it is allowed, but never onto a shop someone else already runs.
  if (input.storeId) {
    await assertStoreUnclaimed(input.storeId, ownerId);
    changes.storeId = input.storeId;
  }

  const owner = await UserModel.findOneAndUpdate(
    { _id: ownerId, role: "store_owner" },
    { $set: changes },
    { returnDocument: "after" },
  )
    .populate("storeId", "name slug")
    .exec();

  if (!owner) throw new NotFoundException("Store owner not found");

  return toRow(owner as never);
};

/**
 * Deactivates rather than deletes.
 *
 * Their past orders reference this account, and removing the row would orphan
 * an audit trail that a shop may need months later. `isActive: false` already
 * blocks sign-in.
 */
export const deactivateStoreOwner = async (ownerId: string): Promise<void> => {
  const owner = await UserModel.findOneAndUpdate(
    { _id: ownerId, role: "store_owner" },
    { $set: { isActive: false } },
  ).exec();

  if (!owner) throw new NotFoundException("Store owner not found");
};
