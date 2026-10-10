import { useQuery } from "@tanstack/react-query";

import { getImagePresetsQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * The preset catalogue, and whether real photographs can be uploaded at all.
 *
 * Both answers come from the API in one call: the picker has to know what to
 * offer before the owner presses anything, and the list only changes when
 * someone edits the API.
 */
export const useImagePresets = () =>
  useQuery({
    queryKey: queryKeys.imagePresets,
    queryFn: getImagePresetsQueryFn,
    select: (response) => response.data,
    staleTime: Infinity,
  });
