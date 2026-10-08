import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createProductMutationFn,
  createStoreMutationFn,
  deleteProductMutationFn,
  deleteStoreMutationFn,
  getProductCategoriesQueryFn,
  getProductsQueryFn,
  getStoreQueryFn,
  getStoresQueryFn,
  updateProductMutationFn,
  updateStoreMutationFn,
  type ProductFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useStores = (params?: { search?: string; storeType?: string }) =>
  useQuery({
    queryKey: queryKeys.adminStores(params ?? {}),
    queryFn: () => getStoresQueryFn(params),
    placeholderData: (previous) => previous,
    select: (response) => response.data.stores,
  });

export const useStore = (slug: string) =>
  useQuery({
    queryKey: queryKeys.adminStore(slug),
    queryFn: () => getStoreQueryFn(slug),
    enabled: Boolean(slug),
    select: (response) => response.data,
  });

export const useProducts = (filters: ProductFilters) =>
  useQuery({
    queryKey: queryKeys.adminProducts(filters),
    queryFn: () => getProductsQueryFn(filters),
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

export const useProductCategories = () =>
  useQuery({
    queryKey: queryKeys.adminProductCategories,
    queryFn: getProductCategoriesQueryFn,
    select: (response) => response.data.categories,
    // The taxonomy changes when someone edits it, not when stock moves.
    staleTime: 5 * 60_000,
  });

/**
 * The store list, the store detail and the product list are three caches of
 * overlapping data, so any write has to stale all of them — otherwise the page
 * that was just edited keeps showing the old values.
 *
 * Deliberately a broad invalidation rather than a surgical cache patch: an admin
 * editing a shelf is not in a hot loop, and a wrong figure in a backoffice is
 * worse than a refetch.
 */
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["adminStores"] });
  void queryClient.invalidateQueries({ queryKey: ["adminStore"] });
  void queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
  void queryClient.invalidateQueries({ queryKey: ["adminProductCategories"] });
};

const useCatalogueMutation = <TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn, onSuccess: () => refresh(queryClient) });
};

export const useCreateStore = () => useCatalogueMutation(createStoreMutationFn);
export const useUpdateStore = () => useCatalogueMutation(updateStoreMutationFn);
export const useDeleteStore = () => useCatalogueMutation(deleteStoreMutationFn);

export const useCreateProduct = () => useCatalogueMutation(createProductMutationFn);
export const useUpdateProduct = () => useCatalogueMutation(updateProductMutationFn);
export const useDeleteProduct = () => useCatalogueMutation(deleteProductMutationFn);
