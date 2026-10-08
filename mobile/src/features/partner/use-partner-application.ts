import { useMutation, useQuery } from "@tanstack/react-query";

import { applyToBePartnerMutationFn, getMyApplicationQueryFn } from "@/lib/api";

export const useApplyToBePartner = () =>
  useMutation({ mutationFn: applyToBePartnerMutationFn });

/** Where an application got to, so the app can say rather than leave them guessing. */
export const useMyApplication = (enabled = true) =>
  useQuery({
    queryKey: ["myApplication"],
    queryFn: getMyApplicationQueryFn,
    enabled,
    select: (response) => response.data.application,
  });
