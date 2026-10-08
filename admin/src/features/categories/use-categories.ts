import { useQuery } from "@tanstack/react-query";

import { getCategoriesQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * "Offers" is a merchandising shelf, not a kind of food, so it is never a place
 * to file a dish. Everything else in the catalogue is fair game.
 */
const NOT_A_DISH_CATEGORY = ["offers"];

export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategoriesQueryFn,
    staleTime: 5 * 60_000,
    select: (response) =>
      response.data.categories.filter((category) => !NOT_A_DISH_CATEGORY.includes(category.slug)),
  });
