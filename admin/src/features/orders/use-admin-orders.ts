import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAdminOrderQueryFn,
  getAdminOrdersQueryFn,
  getRestaurantsQueryFn,
  releaseRiderMutationFn,
  refundOrderMutationFn,
  updateOrderStatusMutationFn,
  type AdminOrderFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminOrders = (filters: AdminOrderFilters) =>
  useQuery({
    queryKey: queryKeys.adminOrders(filters),
    queryFn: () => getAdminOrdersQueryFn(filters),
    // Keep the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

export const useAdminOrder = (id: string) =>
  useQuery({
    queryKey: queryKeys.adminOrder(id),
    queryFn: () => getAdminOrderQueryFn(id),
    enabled: Boolean(id),
    select: (response) => response.data.order,
  });

export const useRestaurantOptions = () =>
  useQuery({
    queryKey: queryKeys.restaurants,
    queryFn: getRestaurantsQueryFn,
    staleTime: 5 * 60_000,
    select: (response) => response.data.restaurants,
  });

/** Releasing frees the order back to the queue; the same caches are stale after it. */
export const useReleaseRider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: releaseRiderMutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      void queryClient.invalidateQueries({ queryKey: ["adminOrder"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};

/** Moving an order changes the dashboard too, so both caches are refreshed. */
export const useRefundOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refundOrderMutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminOrder"] });
      void queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      // A full refund restores stock, so the catalogue counts move too.
      void queryClient.invalidateQueries({ queryKey: ["adminProducts"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateOrderStatusMutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["adminOrders"] });
      void queryClient.invalidateQueries({ queryKey: ["adminOrder"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};
