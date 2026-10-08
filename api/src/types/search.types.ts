/** What a search returns across every catalogue OnlineMall sells from. */

import { DishDocument } from "../models/dish.model";
import { ProductDocument } from "../models/product.model";
import { RestaurantDocument } from "../models/restaurant.model";
import { StoreDocument } from "../models/store.model";

export type SearchResults = {
  /** Packaged goods. Listed first in the UI: it is what most searches are for. */
  products: ProductDocument[];
  stores: StoreDocument[];
  restaurants: RestaurantDocument[];
  dishes: DishDocument[];
};
