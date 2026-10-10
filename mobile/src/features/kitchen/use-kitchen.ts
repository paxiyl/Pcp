import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  advanceKitchenOrderMutationFn,
  getKitchenDishesQueryFn,
  getKitchenOrdersQueryFn,
  getKitchenOverviewQueryFn,
  setDishAvailableMutationFn,
  setKitchenOpenMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * A kitchen during service is watched, not browsed — same reasoning as the shop
 * counter, and the same interval. Fast enough that a new order lands before the
 * customer rings to ask, slow enough not to put a phone on a five-second loop
 * through the whole dinner rush.
 */
const KITCHEN_REFETCH = 20_000;

export const useKitchenOverview = () =>
  useQuery({
    queryKey: queryKeys.kitchenOverview,
    queryFn: getKitchenOverviewQueryFn,
    refetchInterval: KITCHEN_REFETCH,
    select: (response) => response.data,
  });

export const useKitchenOrders = (status?: string) =>
  useQuery({
    queryKey: queryKeys.kitchenOrders(status ?? "all"),
    queryFn: () => getKitchenOrdersQueryFn(status),
    refetchInterval: KITCHEN_REFETCH,
    select: (response) => response.data.orders,
  });

export const useKitchenDishes = () =>
  useQuery({
    queryKey: queryKeys.kitchenDishes,
    queryFn: getKitchenDishesQueryFn,
    placeholderData: (previous) => previous,
    select: (response) => response.data.dishes,
  });

/** All three screens read the same records, so one write stales the lot. */
const refresh = (queryClient: ReturnType<typeof useQueryClient>) => {
  void queryClient.invalidateQueries({ queryKey: ["kitchenOverview"] });
  void queryClient.invalidateQueries({ queryKey: ["kitchenOrders"] });
  void queryClient.invalidateQueries({ queryKey: ["kitchenDishes"] });
};

const useKitchenMutation = <TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn, onSuccess: () => refresh(queryClient) });
};

export const useAdvanceKitchenOrder = () => useKitchenMutation(advanceKitchenOrderMutationFn);
export const useSetDishAvailable = () => useKitchenMutation(setDishAvailableMutationFn);
export const useSetKitchenOpen = () => useKitchenMutation(setKitchenOpenMutationFn);
