import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProductCategoryMutationFn,
  createStoreOwnerMutationFn,
  deactivateStoreOwnerMutationFn,
  deleteProductCategoryMutationFn,
  getStoreOwnersQueryFn,
  updateProductCategoryMutationFn,
  updateStoreOwnerMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useStoreOwners = (params?: { search?: string }) =>
  useQuery({
    queryKey: queryKeys.adminStoreOwners(params ?? {}),
    queryFn: () => getStoreOwnersQueryFn(params),
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

const refreshOwners = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["adminStoreOwners"] });
};

const useOwnerMutation = <TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn, onSuccess: () => refreshOwners(queryClient) });
};

export const useCreateStoreOwner = () => useOwnerMutation(createStoreOwnerMutationFn);
export const useUpdateStoreOwner = () => useOwnerMutation(updateStoreOwnerMutationFn);
export const useDeactivateStoreOwner = () => useOwnerMutation(deactivateStoreOwnerMutationFn);

/**
 * The taxonomy drives both the home strip and the product form's category
 * select, so a write has to stale the category cache everywhere it is read.
 */
const useCategoryMutation = <TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminProductCategories"] });
      void queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
    },
  });
};

export const useCreateProductCategory = () => useCategoryMutation(createProductCategoryMutationFn);
export const useUpdateProductCategory = () => useCategoryMutation(updateProductCategoryMutationFn);
export const useDeleteProductCategory = () => useCategoryMutation(deleteProductCategoryMutationFn);
