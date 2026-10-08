import { CategoryModel } from "../models/category.model";
import { AdminCategoryList, AdminCategoryRow } from "../types/admin-category.types";

/**
 * The catalogue with the two counts the backoffice cares about, in one pass.
 *
 * Restaurants are a real reference (`restaurants.categories` holds category ids).
 * Dishes are not: a dish is filed under a `section` name, which the dish form now
 * fills from this same catalogue, so the count matches by name and only counts
 * dishes whose section still reads exactly like the category.
 */
export const listAdminCategories = async (): Promise<AdminCategoryList> => {
  const categories = await CategoryModel.aggregate<AdminCategoryRow>([
    { $sort: { sortOrder: 1, name: 1 } },
    {
      $lookup: {
        as: "restaurants",
        from: "restaurants",
        let: { categoryId: "$_id" },
        pipeline: [
          { $match: { $expr: { $in: ["$$categoryId", { $ifNull: ["$categories", []] }] } } },
          { $count: "count" },
        ],
      },
    },
    {
      $lookup: {
        as: "dishes",
        from: "dishes",
        let: { categoryName: "$name" },
        pipeline: [
          { $match: { $expr: { $eq: ["$section", "$$categoryName"] } } },
          { $count: "count" },
        ],
      },
    },
    {
      $project: {
        backgroundColor: 1,
        dishCount: { $ifNull: [{ $first: "$dishes.count" }, 0] },
        imageUrl: 1,
        isActive: 1,
        name: 1,
        restaurantCount: { $ifNull: [{ $first: "$restaurants.count" }, 0] },
        slug: 1,
        sortOrder: 1,
      },
    },
  ]);

  return {
    categories,
    stats: {
      active: categories.filter((category) => category.isActive).length,
      total: categories.length,
    },
  };
};
