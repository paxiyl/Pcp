import { useQuery } from "@tanstack/react-query";

import { getCategoriesQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** Home-strip categories. The catalogue is public, so this runs signed out too. */
export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategoriesQueryFn,
    select: (response) => response.data.categories,
    staleTime: 5 * 60 * 1000,
  });
