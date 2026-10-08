import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCategoryMutationFn,
  getAdminCategoriesQueryFn,
  reorderCategoriesMutationFn,
  updateCategoryMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminCategories = () =>
  useQuery({
    queryKey: queryKeys.adminCategories,
    queryFn: getAdminCategoriesQueryFn,
    select: (response) => response.data,
  });

/**
 * The public catalogue the dish form reads is the same collection, so any write
 * stales both caches.
 */
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["adminCategories"] });
  void queryClient.invalidateQueries({ queryKey: ["categories"] });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCategoryMutationFn,
    onSuccess: () => refresh(queryClient),
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCategoryMutationFn,
    onSuccess: () => refresh(queryClient),
  });
};

export const useReorderCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderCategoriesMutationFn,
    onSuccess: () => refresh(queryClient),
  });
};
