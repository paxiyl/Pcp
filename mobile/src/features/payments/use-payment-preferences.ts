import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPaymentPreferencesQueryFn, setPaymentPreferenceMutationFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * How this customer prefers to pay.
 *
 * Kept fresh for a while rather than refetched on every mount: the answer only
 * changes when they change it, or when an admin switches cash off.
 */
export const usePaymentPreferences = () =>
  useQuery({
    queryKey: queryKeys.paymentPreferences,
    queryFn: getPaymentPreferencesQueryFn,
    select: (response) => response.data,
    staleTime: 5 * 60 * 1000,
  });

export const useSetPaymentPreference = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setPaymentPreferenceMutationFn,
    // The server returns the recomputed preferences, so the cache takes them
    // directly instead of asking again for what we were just told.
    onSuccess: (response) =>
      queryClient.setQueryData(queryKeys.paymentPreferences, response),
  });
};
