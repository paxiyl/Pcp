import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAddressMutationFn,
  getAddressesQueryFn,
  setDefaultAddressMutationFn,
  updateAddressMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAddresses = () =>
  useQuery({
    queryKey: queryKeys.addresses,
    queryFn: getAddressesQueryFn,
    select: (response) => response.data.addresses,
  });

/** The address the app delivers to: the default one, else the most recent. */
export const useDefaultAddress = () => {
  const query = useAddresses();

  return {
    ...query,
    data: query.data?.find((address) => address.isDefault) ?? query.data?.[0],
  };
};

export const useCreateAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAddressMutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
};

export const useUpdateAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAddressMutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
};

/**
 * Switching the delivery address: the API clears the flag on the others, so the
 * whole list is refetched rather than patched locally.
 */
export const useSetDefaultAddress = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultAddressMutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.addresses });
    },
  });
};
