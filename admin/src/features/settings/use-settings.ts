import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSettingsQueryFn, updateSettingsMutationFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useSettings = () =>
  useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettingsQueryFn,
    select: (response) => response.data.settings,
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettingsMutationFn,
    // Rates feed the restaurants list (the "default" commission) too.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["adminRestaurants"] });
    },
  });
};
