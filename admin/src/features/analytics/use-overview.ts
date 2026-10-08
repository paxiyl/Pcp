import { useQuery } from "@tanstack/react-query";

import { getOverviewQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** Dashboard figures. Shared by the shell (sidebar badge) and the overview page. */
export const useOverview = (days: number) =>
  useQuery({
    queryKey: queryKeys.overview(days),
    queryFn: () => getOverviewQueryFn(days),
    select: (response) => response.data,
  });
