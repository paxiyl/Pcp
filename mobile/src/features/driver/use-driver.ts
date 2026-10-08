import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  claimDeliveryMutationFn,
  completeDeliveryMutationFn,
  getDeliveryQueryFn,
  getDriverHomeQueryFn,
  pickUpDeliveryMutationFn,
  setDriverOnlineMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** The queue moves as other riders claim, so this refreshes while it is open. */
export const useDriverHome = () =>
  useQuery({
    queryKey: queryKeys.driverHome,
    queryFn: getDriverHomeQueryFn,
    refetchInterval: 20_000,
    select: (response) => response.data,
  });

export const useDelivery = (id: string) =>
  useQuery({
    queryKey: queryKeys.delivery(id),
    queryFn: () => getDeliveryQueryFn(id),
    enabled: Boolean(id),
    select: (response) => response.data,
  });

/** Every delivery action returns the order, so the caches are replaced, not patched. */
const useDeliveryMutation = (mutationFn: (id: string) => ReturnType<typeof getDeliveryQueryFn>) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.delivery(response.data.order._id), response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
      // The customer's own view of this order has changed too.
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(response.data.order._id) });
    },
  });
};

export const useClaimDelivery = () => useDeliveryMutation(claimDeliveryMutationFn);
export const usePickUpDelivery = () => useDeliveryMutation(pickUpDeliveryMutationFn);

/** Handing over needs the customer's code, so this one takes more than an id. */
export const useCompleteDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeDeliveryMutationFn,
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.delivery(response.data.order._id), response);
      void queryClient.invalidateQueries({ queryKey: queryKeys.driverHome });
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(response.data.order._id) });
    },
  });
};

export const useSetOnline = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDriverOnlineMutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.driverHome }),
  });
};
