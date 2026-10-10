import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getOutstandingQueryFn,
  getSettlementHistoryQueryFn,
  settleRiderMutationFn,
  settleVendorMutationFn,
  type Settlement,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * Refetched on a timer, because this screen is read while money is physically
 * changing hands: a rider finishing a delivery in the next room moves these
 * numbers, and settling against a stale figure is the one mistake here that
 * costs somebody real money.
 */
export const useOutstanding = () =>
  useQuery({
    queryKey: queryKeys.outstanding,
    queryFn: getOutstandingQueryFn,
    refetchInterval: 60_000,
    select: (response) => response.data,
  });

export const useSettlementHistory = (party?: Settlement["party"]) =>
  useQuery({
    queryKey: queryKeys.settlementHistory(party),
    queryFn: () => getSettlementHistoryQueryFn(party),
    placeholderData: (previous) => previous,
    select: (response) => response.data.settlements,
  });

/** Both legs invalidate the same two lists: a balance cleared is a run recorded. */
const onSettled = (queryClient: ReturnType<typeof useQueryClient>) => () =>
  void queryClient.invalidateQueries({ queryKey: ["settlements"] });

export const useSettleRider = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: settleRiderMutationFn, onSuccess: onSettled(queryClient) });
};

export const useSettleVendor = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: settleVendorMutationFn, onSuccess: onSettled(queryClient) });
};
