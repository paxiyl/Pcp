import mongoose from "mongoose";

import {
  ApplicationStatus,
  PartnerApplicationDocument,
  PartnerApplicationModel,
  PartnerRole,
} from "../models/partner-application.model";
import { RestaurantModel } from "../models/restaurant.model";
import { StoreModel } from "../models/store.model";
import { UserDocument, UserModel } from "../models/user.model";
import { BadRequestException, NotFoundException } from "../utils/app-error";
import {
  ApplicationReviewInput,
  PartnerApplicationInput,
} from "../validators/partner-application.validator";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Two shops called Sharma General Store should both be able to join. */
const uniqueSlug = async (
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> => {
  const base = slugify(name) || "partner";
  let slug = base;
  let suffix = 2;

  while (await exists(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

export const applyToBePartner = async (
  user: UserDocument,
  input: PartnerApplicationInput,
): Promise<PartnerApplicationDocument> => {
  if (user.role !== "customer") {
    throw new BadRequestException("This account is already a partner account");
  }

  const open = await PartnerApplicationModel.findOne({
    status: "pending",
    userId: user._id,
  }).exec();

  if (open) {
    throw new BadRequestException("Your application is already with us. We will be in touch.");
  }

  if (input.requestedRole !== "driver" && !input.businessName) {
    throw new BadRequestException("Tell us the name of your shop or kitchen");
  }

  return PartnerApplicationModel.create({ ...input, userId: user._id });
};

/** The applicant's own application, so the app can show where it got to. */
export const myApplication = async (
  user: UserDocument,
): Promise<PartnerApplicationDocument | null> =>
  PartnerApplicationModel.findOne({ userId: user._id }).sort({ createdAt: -1 }).exec();

export const listApplications = async (
  status?: ApplicationStatus,
): Promise<PartnerApplicationDocument[]> =>
  PartnerApplicationModel.find(status ? { status } : {})
    .populate("userId", "name email phone")
    .sort({ createdAt: -1 })
    .limit(200)
    .exec();

/** Creates the venue an approved partner will run, and links the account to it. */
const grantRole = async (
  application: PartnerApplicationDocument,
  role: PartnerRole,
): Promise<void> => {
  if (role === "driver") {
    await UserModel.updateOne(
      { _id: application.userId },
      { $set: { driverStatus: "approved", role: "driver" } },
    ).exec();

    return;
  }

  const name = application.businessName ?? "Partner";

  if (role === "store_owner") {
    const slug = await uniqueSlug(name, async (candidate) =>
      Boolean(await StoreModel.exists({ slug: candidate }).exec()),
    );
    const store = await StoreModel.create({ area: application.area, name, slug });

    await UserModel.updateOne(
      { _id: application.userId },
      { $set: { role, storeId: store._id }, $unset: { restaurantId: "" } },
    ).exec();

    return;
  }

  const slug = await uniqueSlug(name, async (candidate) =>
    Boolean(await RestaurantModel.exists({ slug: candidate }).exec()),
  );
  // Restaurants carry no `area` field the way stores do; the applicant's area
  // stays on the application for the admin to place when they fill the rest in.
  const restaurant = await RestaurantModel.create({ name, slug });

  await UserModel.updateOne(
    { _id: application.userId },
    { $set: { restaurantId: restaurant._id, role }, $unset: { storeId: "" } },
  ).exec();
};

export const reviewApplication = async (
  admin: UserDocument,
  applicationId: string,
  input: ApplicationReviewInput,
): Promise<PartnerApplicationDocument> => {
  const application = await PartnerApplicationModel.findById(applicationId).exec();

  if (!application) throw new NotFoundException("Application not found");

  if (application.status !== "pending") {
    throw new BadRequestException("This application has already been decided");
  }

  // The role moves first. If creating the venue fails, nothing has been granted
  // and the application is still pending for another try.
  if (input.status === "approved") {
    await grantRole(application, application.requestedRole);
  }

  application.status = input.status;
  application.reviewNote = input.reviewNote;
  application.reviewedAt = new Date();
  application.reviewedBy = admin._id as mongoose.Types.ObjectId;

  await application.save();

  return application;
};
