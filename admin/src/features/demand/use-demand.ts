import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getDemandQueryFn, resolveDemandMutationFn, type DemandMode } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useDemand = (mode: DemandMode | "all", includeResolved: boolean) =>
  useQuery({
    queryKey: queryKeys.demand(mode, includeResolved),
    queryFn: () =>
      getDemandQueryFn({
        includeResolved,
        mode: mode === "all" ? undefined : mode,
      }),
    placeholderData: (previous) => previous,
    select: (response) => response.data.signals,
    // Demand moves slowly and this is a planning screen, not a live one.
    staleTime: 60_000,
  });

export const useResolveDemand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: resolveDemandMutationFn,
    // Resolving moves a row out of the default list, so every tab refreshes.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["demand"] }),
  });
};
