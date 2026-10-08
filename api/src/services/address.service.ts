import mongoose, { Types } from "mongoose";

import { UserAddressDocument, UserAddressModel } from "../models/user-address.model";
import { NotFoundException } from "../utils/app-error";
import { AddressInput } from "../validators/address.validator";

/**
 * Every function is scoped by userId, so one customer can never read or mutate
 * another's addresses. Filters and updates are built from validated fields only.
 */

const toLocation = (input: AddressInput) =>
  input.latitude !== undefined && input.longitude !== undefined
    ? { coordinates: [input.longitude, input.latitude] as [number, number], type: "Point" as const }
    : undefined;

const clearOtherDefaults = async (userId: string, exceptId?: Types.ObjectId) => {
  await UserAddressModel.updateMany(
    // `sanitizeFilter` strips operators from filter values, so this server-authored
    // $ne must be marked trusted or it is cast as a literal _id.
    { _id: mongoose.trusted({ $ne: exceptId }), userId },
    { $set: { isDefault: false } },
  ).exec();
};

/** The address the app delivers to, so clients can render it without a second call. */
export const findDefaultAddress = (userId: string): Promise<UserAddressDocument | null> =>
  UserAddressModel.findOne({ isDefault: true, userId }).exec();

export const listAddresses = (userId: string): Promise<UserAddressDocument[]> =>
  UserAddressModel.find({ userId }).sort({ isDefault: -1, createdAt: -1 }).exec();

export const createAddress = async (
  userId: string,
  input: AddressInput,
): Promise<UserAddressDocument> => {
  const existingCount = await UserAddressModel.countDocuments({ userId }).exec();
  const shouldBeDefault = input.isDefault ?? existingCount === 0;

  const address = await UserAddressModel.create({
    city: input.city,
    instructions: input.instructions,
    isDefault: shouldBeDefault,
    label: input.label,
    line1: input.line1,
    line2: input.line2,
    location: toLocation(input),
    postcode: input.postcode,
    userId,
  });

  if (shouldBeDefault) await clearOtherDefaults(userId, address._id);

  return address;
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<UserAddressDocument> => {
  const address = await UserAddressModel.findOneAndUpdate(
    { _id: addressId, userId },
    {
      $set: {
        city: input.city,
        instructions: input.instructions,
        label: input.label,
        line1: input.line1,
        line2: input.line2,
        location: toLocation(input),
        postcode: input.postcode,
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
      },
    },
    { returnDocument: "after" },
  ).exec();

  if (!address) throw new NotFoundException("Address not found");

  if (address.isDefault) await clearOtherDefaults(userId, address._id);

  return address;
};

export const setDefaultAddress = async (
  userId: string,
  addressId: string,
): Promise<UserAddressDocument> => {
  const address = await UserAddressModel.findOneAndUpdate(
    { _id: addressId, userId },
    { $set: { isDefault: true } },
    { returnDocument: "after" },
  ).exec();

  if (!address) throw new NotFoundException("Address not found");

  await clearOtherDefaults(userId, address._id);

  return address;
};

export const deleteAddress = async (userId: string, addressId: string): Promise<void> => {
  const address = await UserAddressModel.findOneAndDelete({ _id: addressId, userId }).exec();

  if (!address) throw new NotFoundException("Address not found");

  // Keep exactly one default alive when the default was the one removed.
  if (address.isDefault) {
    const next = await UserAddressModel.findOne({ userId }).sort({ createdAt: -1 }).exec();

    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
};
