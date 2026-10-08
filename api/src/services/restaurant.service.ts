import mongoose from "mongoose";

import { CategoryModel } from "../models/category.model";
import { DishDocument, DishModel } from "../models/dish.model";
import { RestaurantDocument, RestaurantModel } from "../models/restaurant.model";
import { NotFoundException } from "../utils/app-error";
import {
  DishInput,
  RestaurantInput,
  RestaurantQuery,
  DishUpdateInput,
  RestaurantUpdateInput,
} from "../validators/restaurant.validator";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toLocation = (input: { latitude?: number; longitude?: number }) =>
  input.latitude !== undefined && input.longitude !== undefined
    ? { coordinates: [input.longitude, input.latitude] as [number, number], type: "Point" as const }
    : undefined;

/**
 * Home feed and search. Filters are built from validated fields only — the raw
 * query object never reaches Mongoose.
 */
export const listRestaurants = async (query: RestaurantQuery): Promise<RestaurantDocument[]> => {
  const filter: Record<string, unknown> = { isActive: true };

  if (query.category) {
    const category = await CategoryModel.findOne({ slug: query.category.toLowerCase() })
      .select("_id")
      .exec();

    // An unknown category matches nothing rather than silently returning everything.
    if (!category) return [];

    filter.categories = category._id;
  }

  if (query.search) {
    // The term is escaped so user input can never smuggle in regex syntax, and the
    // operator itself is marked trusted because `sanitizeFilter` would otherwise
    // cast it to a literal string.
    const term = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = mongoose.trusted({
       $options: "i", $regex: term
       });

    filter.$or = [{ name: matches }, { cuisines: matches }];
  }

  return RestaurantModel.find(filter)
    .sort({ sortOrder: 1, rating: -1 })
    .populate("categories", "name slug")
    .exec();
};

export const findRestaurantBySlug = async (
  slug: string,
): Promise<{ restaurant: RestaurantDocument; dishes: DishDocument[] }> => {
  const restaurant = await RestaurantModel.findOne({ isActive: true, slug: slug.toLowerCase() })
    .populate("categories", "name slug")
    .exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  const dishes = await DishModel.find({ isAvailable: true, restaurantId: restaurant._id })
    .sort({ sortOrder: 1, name: 1 })
    .exec();

  return { dishes, restaurant };
};

export const createRestaurant = (input: RestaurantInput): Promise<RestaurantDocument> =>
  RestaurantModel.create({
    address: input.address,
    categories: input.categories,
    closesAt: input.closesAt,
    cuisines: input.cuisines,
    deliveryFee: input.deliveryFee,
    description: input.description,
    imagePublicId: input.imagePublicId,
    imageUrl: input.imageUrl,
    isActive: input.isActive ?? true,
    isOpen: input.isOpen ?? true,
    location: toLocation(input),
    freeDeliveryThreshold: input.freeDeliveryThreshold,
    minOrder: input.minOrder,
    name: input.name,
    prepTimeMaxMinutes: input.prepTimeMaxMinutes,
    prepTimeMinMinutes: input.prepTimeMinMinutes,
    rating: input.rating,
    ratingCount: input.ratingCount,
    slug: input.slug ?? slugify(input.name),
    sortOrder: input.sortOrder ?? 0,
  });

export const updateRestaurant = async (
  restaurantId: string,
  input: RestaurantUpdateInput,
): Promise<RestaurantDocument> => {
  const fields = [
    "address",
    "categories",
    "closesAt",
    "commissionRate",
    "cuisines",
    "deliveryFee",
    "description",
    "imagePublicId",
    "imageUrl",
    "freeDeliveryThreshold",
    "isActive",
    "isOpen",
    "minOrder",
    "name",
    "prepTimeMaxMinutes",
    "prepTimeMinMinutes",
    "rating",
    "ratingCount",
    "sortOrder",
  ] as const;

  const changes: Record<string, unknown> = {};

  for (const field of fields) {
    if (input[field] !== undefined) changes[field] = input[field];
  }

  // Renaming re-slugs, unless a slug was given explicitly.
  if (input.slug !== undefined) changes.slug = input.slug;
  else if (input.name !== undefined) changes.slug = slugify(input.name);

  if (input.latitude !== undefined && input.longitude !== undefined) {
    changes.location = toLocation(input);
  }

  const restaurant = await RestaurantModel.findByIdAndUpdate(
    restaurantId,
    { $set: changes },
    { returnDocument: "after" },
  ).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  return restaurant;
};

export const deleteRestaurant = async (restaurantId: string): Promise<void> => {
  const restaurant = await RestaurantModel.findByIdAndDelete(restaurantId).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  // A menu without its restaurant is unreachable, so it goes too.
  await DishModel.deleteMany({ restaurantId: restaurant._id }).exec();
};

/* Dishes */

/** Powers the dish sheet; the restaurant comes along for basket context. */
export const findDishById = async (
  dishId: string,
): Promise<{ dish: DishDocument; restaurant: RestaurantDocument }> => {
  const dish = await DishModel.findOne({ _id: dishId, isAvailable: true }).exec();

  if (!dish) throw new NotFoundException("Dish not found");

  const restaurant = await RestaurantModel.findById(dish.restaurantId).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  return { dish, restaurant };
};

export const createDish = async (
  restaurantId: string,
  input: DishInput,
): Promise<DishDocument> => {
  const restaurant = await RestaurantModel.exists({ _id: restaurantId }).exec();

  if (!restaurant) throw new NotFoundException("Restaurant not found");

  return DishModel.create({
    allergens: input.allergens,
    calories: input.calories,
    description: input.description,
    imagePublicId: input.imagePublicId,
    imageUrl: input.imageUrl,
    isAvailable: input.isAvailable ?? true,
    isPopular: input.isPopular ?? false,
    name: input.name,
    optionGroups: input.optionGroups,
    price: input.price,
    restaurantId,
    section: input.section,
    sortOrder: input.sortOrder ?? 0,
  });
};

export const updateDish = async (
  dishId: string,
  input: DishUpdateInput,
): Promise<DishDocument> => {
  const fields = [
    "allergens",
    "calories",
    "description",
    "imagePublicId",
    "imageUrl",
    "isAvailable",
    "isPopular",
    "name",
    "optionGroups",
    "price",
    "section",
    "sortOrder",
  ] as const;

  const changes: Record<string, unknown> = {};

  for (const field of fields) {
    if (input[field] !== undefined) changes[field] = input[field];
  }

  const dish = await DishModel.findByIdAndUpdate(
    dishId,
    { $set: changes },
    { returnDocument: "after" },
  ).exec();

  if (!dish) throw new NotFoundException("Dish not found");

  return dish;
};

export const deleteDish = async (dishId: string): Promise<void> => {
  const dish = await DishModel.findByIdAndDelete(dishId).exec();

  if (!dish) throw new NotFoundException("Dish not found");
};
