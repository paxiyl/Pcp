import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import {
  getCurrentUserQueryFn,
  loginMutationFn,
  logoutMutationFn,
  registerMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { clearAccessToken, setAccessToken } from "./token-storage";

/** The signed-in user, served from cache and refreshed by /auth/me. */
export const useCurrentUser = () =>
  useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUserQueryFn,
    select: (response) => response.data.user,
  });

export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginMutationFn,
    onSuccess: async (response) => {
      await setAccessToken(response.data.accessToken);
      queryClient.setQueryData(queryKeys.accessToken, response.data.accessToken);
      queryClient.setQueryData(queryKeys.currentUser, {
        data: {
          defaultAddress: response.data.defaultAddress,
          hasAddress: response.data.hasAddress,
          user: response.data.user,
        },
      });
      // Seed the address cache too: the home header renders with no extra request.
      if (response.data.defaultAddress) {
        queryClient.setQueryData(queryKeys.addresses, {
          data: { addresses: [response.data.defaultAddress] },
        });
      }
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerMutationFn,
    onSuccess: async (response) => {
      await setAccessToken(response.data.accessToken);
      queryClient.setQueryData(queryKeys.accessToken, response.data.accessToken);
      queryClient.setQueryData(queryKeys.currentUser, {
        data: {
          defaultAddress: response.data.defaultAddress,
          hasAddress: response.data.hasAddress,
          user: response.data.user,
        },
      });
      // Seed the address cache too: the home header renders with no extra request.
      if (response.data.defaultAddress) {
        queryClient.setQueryData(queryKeys.addresses, {
          data: { addresses: [response.data.defaultAddress] },
        });
      }
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: logoutMutationFn,
    // Local sign-out must happen even when the network call fails.
    onSettled: async () => {
      await clearAccessToken();
      queryClient.clear();
      router.replace("/welcome");
    },
  });
};
