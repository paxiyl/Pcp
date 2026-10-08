import mongoose from "mongoose";

import { CategoryDocument, CategoryModel } from "../models/category.model";
import { NotFoundException } from "../utils/app-error";
import {
  CategoryInput,
  CategoryReorderInput,
  CategoryUpdateInput,
} from "../validators/category.validator";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * The slug is generated, never typed, so the server owns uniqueness: "Wraps"
 * twice becomes "wraps" and "wraps-2" rather than a duplicate-key error. The
 * category being renamed is excluded, so re-saving it keeps its own slug.
 */
const uniqueSlug = async (name: string, excludeId?: string): Promise<string> => {
  const base = slugify(name) || "category";
  let candidate = base;

  for (let suffix = 2; ; suffix += 1) {
    const clash = await CategoryModel.exists({
      slug: candidate,
      ...(excludeId ? { _id: mongoose.trusted({ $ne: excludeId }) } : {}),
    }).exec();

    if (!clash) return candidate;

    candidate = `${base}-${suffix}`;
  }
};

/** What the mobile home strip reads: active categories in display order. */
export const listActiveCategories = (): Promise<CategoryDocument[]> =>
  CategoryModel.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).exec();

export const listAllCategories = (): Promise<CategoryDocument[]> =>
  CategoryModel.find().sort({ sortOrder: 1, name: 1 }).exec();

export const createCategory = async (input: CategoryInput): Promise<CategoryDocument> =>
  CategoryModel.create({
    backgroundColor: input.backgroundColor,
    imagePublicId: input.imagePublicId,
    imageUrl: input.imageUrl,
    isActive: input.isActive ?? true,
    name: input.name,
    slug: await uniqueSlug(input.slug ?? input.name),
    sortOrder: input.sortOrder ?? 0,
  });

/**
 * Only the keys the caller actually sent are written, so a deactivate cannot
 * blank the rest. A rename re-derives the slug, because the slug is generated
 * rather than typed and has to keep following the name.
 */
export const updateCategory = async (
  categoryId: string,
  input: CategoryUpdateInput,
): Promise<CategoryDocument> => {
  const changes: Record<string, unknown> = {};

  for (const key of [
    "backgroundColor",
    "imagePublicId",
    "imageUrl",
    "isActive",
    "name",
    "sortOrder",
  ] as const) {
    if (input[key] !== undefined) changes[key] = input[key];
  }

  const slugSource = input.slug ?? input.name;
  if (slugSource !== undefined) changes.slug = await uniqueSlug(slugSource, categoryId);

  const category = await CategoryModel.findByIdAndUpdate(
    categoryId,
    { $set: changes },
    { returnDocument: "after" },
  ).exec();

  if (!category) throw new NotFoundException("Category not found");

  return category;
};

/** One write per moved row, sent as a single batch so the order never tears. */
export const reorderCategories = async (input: CategoryReorderInput): Promise<void> => {
  await CategoryModel.bulkWrite(
    input.categories.map(({ id, sortOrder }) => ({
      updateOne: { filter: { _id: id }, update: { $set: { sortOrder } } },
    })),
  );
};

export const deleteCategory = async (categoryId: string): Promise<void> => {
  const category = await CategoryModel.findByIdAndDelete(categoryId).exec();

  if (!category) throw new NotFoundException("Category not found");
};
