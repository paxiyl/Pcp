import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { loginMutationFn, logoutMutationFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginMutationFn,
    // Seed the session cache so the guard does not refetch before redirecting.
    onSuccess: (response) =>
      queryClient.setQueryData(queryKeys.currentUser, { data: { user: response.data.user } }),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logoutMutationFn,
    // Signing out locally must happen even when the network call fails.
    onSettled: () => {
      queryClient.clear();
      void navigate("/login", { replace: true });
    },
  });
};
