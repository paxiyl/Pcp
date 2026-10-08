import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBannerMutationFn,
  deleteBannerMutationFn,
  getAdminBannersQueryFn,
  reorderBannersMutationFn,
  updateBannerMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminBanners = () =>
  useQuery({
    queryKey: queryKeys.adminBanners,
    queryFn: getAdminBannersQueryFn,
    select: (response) => response.data,
  });

const refresh = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: ["adminBanners"] });

export const useCreateBanner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBannerMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};

export const useUpdateBanner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateBannerMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};

export const useDeleteBanner = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBannerMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};

export const useReorderBanners = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderBannersMutationFn,
    onSuccess: () => void refresh(queryClient),
  });
};
