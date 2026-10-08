import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createOrderMutationFn,
  getOrderQueryFn,
  getOrdersQueryFn,
  reorderMutationFn,
  syncOrderMutationFn,
  verifyPaymentMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useOrders = () =>
  useQuery({
    queryKey: queryKeys.orders,
    queryFn: getOrdersQueryFn,
    select: (response) => response.data.orders,
  });

export const useOrder = (id: string, options?: { refetchInterval?: number }) =>
  useQuery({
    queryKey: queryKeys.order(id),
    queryFn: () => getOrderQueryFn(id),
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
    select: (response) => response.data.order,
  });

/** Opens a payment for the stored basket. The server prices it, not us. */
export const useCreateOrder = () => useMutation({ mutationFn: createOrderMutationFn });

/** Hands the gateway callback to the server, which is the only thing that can confirm it. */
export const useVerifyPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyPaymentMutationFn,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.order(response.data.order._id), response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.basket });
    },
  });
};

/** Puts a past order back in the basket, then the basket screen takes over. */
export const useReorder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderMutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.basket }),
  });
};

/**
 * Asks the server to re-read the payment from Stripe. Needed because the sheet
 * can close before the webhook lands; the verdict still comes from Stripe.
 */
export const useSyncOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: syncOrderMutationFn,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.order(response.data.order._id), response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      // Paying empties the basket server-side. Removing rather than invalidating
      // drops the stale copy immediately, so no screen can show a paid basket.
      queryClient.removeQueries({ queryKey: queryKeys.basket });
    },
  });
};
