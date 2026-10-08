import { useQuery } from "@tanstack/react-query";

import { getBannersQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * The promotional carousel. Public, so it runs signed out, and cached for a few
 * minutes: an admin scheduling a banner is not a per-second concern.
 */
export const useBanners = () =>
  useQuery({
    queryKey: queryKeys.banners,
    queryFn: getBannersQueryFn,
    select: (response) => response.data.banners,
    staleTime: 5 * 60 * 1000,
  });
