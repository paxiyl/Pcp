import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRiderMutationFn,
  getAdminRidersQueryFn,
  updateRiderMutationFn,
  type AdminRiderFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminRiders = (filters: AdminRiderFilters) =>
  useQuery({
    queryKey: queryKeys.adminRiders(filters),
    queryFn: () => getAdminRidersQueryFn(filters),
    // Keep the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

const refresh = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["adminRiders"] });

export const useCreateRider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRiderMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};

export const useUpdateRider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRiderMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};
