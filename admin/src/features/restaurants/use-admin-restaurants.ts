import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRestaurantMutationFn,
  getAdminRestaurantsQueryFn,
  updateRestaurantMutationFn,
  type AdminRestaurantFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminRestaurants = (filters: AdminRestaurantFilters) =>
  useQuery({
    queryKey: queryKeys.adminRestaurants(filters),
    queryFn: () => getAdminRestaurantsQueryFn(filters),
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

/**
 * The list and the detail page are separate caches of the same document, so a
 * save has to stale both — otherwise the page you edited keeps the old values.
 */
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["adminRestaurants"] });
  void queryClient.invalidateQueries({ queryKey: ["adminRestaurant"] });
};

export const useCreateRestaurant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRestaurantMutationFn,
    onSuccess: () => refresh(queryClient),
  });
};

export const useUpdateRestaurant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRestaurantMutationFn,
    onSuccess: () => refresh(queryClient),
  });
};
