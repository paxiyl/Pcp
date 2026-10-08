import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAdminCustomersQueryFn,
  updateCustomerMutationFn,
  type AdminCustomerFilters,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useAdminCustomers = (filters: AdminCustomerFilters) =>
  useQuery({
    queryKey: queryKeys.adminCustomers(filters),
    queryFn: () => getAdminCustomersQueryFn(filters),
    // Keep the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
    select: (response) => response.data,
  });

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCustomerMutationFn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["adminCustomers"] }),
  });
};
