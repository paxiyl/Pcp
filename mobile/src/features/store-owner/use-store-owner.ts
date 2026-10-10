import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  advanceStoreOrderMutationFn,
  createStoreProductMutationFn,
  deleteStoreProductMutationFn,
  getStoreOverviewQueryFn,
  getStoreOwnerOrdersQueryFn,
  getStoreOwnerProductsQueryFn,
  setStoreOpenMutationFn,
  updateStoreProductMutationFn,
  updateStoreStockMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * A shop counter is watched, not browsed, so the overview and the order list
 * poll. 20 seconds is a compromise: a new order should appear before a customer
 * rings to ask, without putting a kirana's phone on a 5-second loop all day.
 */
const COUNTER_REFETCH = 20_000;

export const useStoreOverview = () =>
  useQuery({
    queryKey: queryKeys.storeOverview,
    queryFn: getStoreOverviewQueryFn,
    refetchInterval: COUNTER_REFETCH,
    select: (response) => response.data,
  });

export const useStoreOwnerOrders = (status?: string) =>
  useQuery({
    queryKey: queryKeys.storeOrders(status ?? "all"),
    queryFn: () => getStoreOwnerOrdersQueryFn(status),
    refetchInterval: COUNTER_REFETCH,
    select: (response) => response.data.orders,
  });

export const useStoreOwnerProducts = (search?: string) =>
  useQuery({
    queryKey: queryKeys.storeProducts(search ?? ""),
    queryFn: () => getStoreOwnerProductsQueryFn(search),
    placeholderData: (previous) => previous,
    select: (response) => response.data.products,
  });

/** Overview, orders and the shelf read the same records, so a write stales all three. */
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["storeOverview"] });
  void queryClient.invalidateQueries({ queryKey: ["storeOrders"] });
  void queryClient.invalidateQueries({ queryKey: ["storeProducts"] });
};

const useCounterMutation = <TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn, onSuccess: () => refresh(queryClient) });
};

export const useAdvanceStoreOrder = () => useCounterMutation(advanceStoreOrderMutationFn);
export const useUpdateStoreStock = () => useCounterMutation(updateStoreStockMutationFn);
export const useCreateStoreProduct = () => useCounterMutation(createStoreProductMutationFn);
export const useUpdateStoreProduct = () => useCounterMutation(updateStoreProductMutationFn);
export const useDeleteStoreProduct = () => useCounterMutation(deleteStoreProductMutationFn);
export const useSetStoreOpen = () => useCounterMutation(setStoreOpenMutationFn);
