import { useQuery } from "@tanstack/react-query";

import { getDishQueryFn, getRestaurantQueryFn, getRestaurantsQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

type Filters = { category?: string; search?: string; veg?: boolean };

/** "all" is a UI-only filter, so it is never sent to the API. */
const toParams = (filters: Filters) => ({
  category: filters.category && filters.category !== "all" ? filters.category : undefined,
  search: filters.search?.trim() || undefined,
  // Only sent when on: an explicit `false` would read as a filter rather than
  // the absence of one, and narrow nothing while busting the query key.
  veg: filters.veg ? true : undefined,
});

export const useRestaurants = (filters: Filters = {}) => {
  const params = toParams(filters);

  return useQuery({
    queryKey: queryKeys.restaurants(params),
    queryFn: () => getRestaurantsQueryFn(params),
    select: (response) => response.data.restaurants,
  });
};

export const useRestaurant = (slug: string) =>
  useQuery({
    queryKey: queryKeys.restaurant(slug),
    queryFn: () => getRestaurantQueryFn(slug),
    enabled: Boolean(slug),
    select: (response) => response.data,
  });

export const useDish = (id: string) =>
  useQuery({
    queryKey: queryKeys.dish(id),
    queryFn: () => getDishQueryFn(id),
    enabled: Boolean(id),
    select: (response) => response.data,
  });
