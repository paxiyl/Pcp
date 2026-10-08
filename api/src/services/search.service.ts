import mongoose from "mongoose";

import { DishModel } from "../models/dish.model";
import { ProductModel } from "../models/product.model";
import { RestaurantModel } from "../models/restaurant.model";
import { StoreModel } from "../models/store.model";
import { SearchResults } from "../types/search.types";

const RESULT_LIMIT = 20;

/**
 * Escapes user input so a search term can never smuggle in regex syntax, then
 * marks the operator trusted because `sanitizeFilter` would otherwise cast it
 * to a literal string.
 */
const matcher = (term: string) =>
  mongoose.trusted({
    $options: "i",
    $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  });

/**
 * One term, four result groups: products, shops, restaurants and dishes.
 *
 * All four run in parallel rather than in sequence — a search that waits on a
 * product query before starting a store query is twice as slow for no reason,
 * and the grouping is decided in the UI, not here.
 *
 * Products are matched on name, brand and tags. Description is deliberately NOT
 * matched: on a packaged-goods catalogue it turns "milk" into every product
 * whose blurb mentions milk, which buries the actual milk.
 */
export const searchCatalogue = async (term: string): Promise<SearchResults> => {
  const matches = matcher(term);

  const [products, stores, restaurants, dishes] = await Promise.all([
    ProductModel.find({
      isAvailable: true,
      $or: [{ name: matches }, { brand: matches }, { tags: matches }],
    })
      // In-stock first: a sold-out result is still worth showing, never above
      // something the customer can actually buy right now.
      .sort({ stock: -1, isPopular: -1 })
      .limit(RESULT_LIMIT)
      .exec(),
    StoreModel.find({
      isActive: true,
      $or: [{ name: matches }, { storeType: matches }, { area: matches }],
    })
      .sort({ isOpen: -1, rating: -1 })
      .limit(RESULT_LIMIT)
      .exec(),
    RestaurantModel.find({ isActive: true, $or: [{ name: matches }, { cuisines: matches }] })
      .sort({ rating: -1 })
      .limit(RESULT_LIMIT)
      .exec(),
    DishModel.find({ isAvailable: true, $or: [{ name: matches }, { description: matches }] })
      .limit(RESULT_LIMIT)
      .populate("restaurantId", "name slug isActive")
      .exec(),
  ]);

  // A dish is only orderable while its restaurant is live.
  const orderable = dishes.filter((dish) => {
    const restaurant = dish.restaurantId as unknown as { isActive?: boolean } | null;

    return restaurant?.isActive !== false;
  });

  return { dishes: orderable, products, restaurants, stores };
};
