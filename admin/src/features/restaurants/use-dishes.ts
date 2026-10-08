import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createDishMutationFn,
  deleteDishMutationFn,
  getAdminRestaurantQueryFn,
  updateDishMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminRestaurant = (id: string) =>
  useQuery({
    queryKey: queryKeys.adminRestaurant(id),
    queryFn: () => getAdminRestaurantQueryFn(id),
    enabled: Boolean(id),
    select: (response) => response.data,
  });

/** Any dish change re-reads the restaurant, which owns the menu. */
const useDishMutation = <TInput>(mutationFn: (input: TInput) => Promise<unknown>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminRestaurant"] }),
  });
};

export const useCreateDish = () => useDishMutation(createDishMutationFn);
export const useUpdateDish = () => useDishMutation(updateDishMutationFn);
export const useDeleteDish = () => useDishMutation(deleteDishMutationFn);
