import { useQuery } from "@tanstack/react-query";

import { getImagePresetsQueryFn, type ImagePreset } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * The preset catalogue, fetched once and kept.
 *
 * Served by the API rather than compiled in, so adding a preset does not need a
 * new build of the app. It never goes stale in a session — presets change when
 * someone edits the API, not while a customer is shopping — and a failure is
 * harmless: a tile with no preset falls back to the item's initial.
 */
export const useImagePresets = () =>
  useQuery({
    queryKey: queryKeys.imagePresets,
    queryFn: getImagePresetsQueryFn,
    select: (response) => response.data.presets,
    staleTime: Infinity,
  });

/** The one preset a tile needs, or undefined while the list is still in flight. */
export const useImagePreset = (key?: string): ImagePreset | undefined => {
  const { data } = useImagePresets();

  if (!key) return undefined;

  return data?.find((preset) => preset.key === key);
};
