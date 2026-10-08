import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getApplicationsQueryFn,
  reviewApplicationMutationFn,
  type ApplicationStatus,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useApplications = (status?: ApplicationStatus) =>
  useQuery({
    queryKey: queryKeys.applications(status),
    queryFn: () => getApplicationsQueryFn(status),
    placeholderData: (previous) => previous,
    select: (response) => response.data.applications,
  });

export const useReviewApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reviewApplicationMutationFn,
    // A decision moves a row between tabs and can mint a shop, so refresh the
    // lists that would otherwise still show the old world.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["applications"] });
      void queryClient.invalidateQueries({ queryKey: ["stores"] });
      void queryClient.invalidateQueries({ queryKey: ["restaurants"] });
      void queryClient.invalidateQueries({ queryKey: ["adminRiders"] });
    },
  });
};
