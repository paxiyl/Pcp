import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import {
  getAuthProvidersQueryFn,
  getCurrentUserQueryFn,
  googleSignInMutationFn,
  loginMutationFn,
  logoutMutationFn,
  registerMutationFn,
} from "@/lib/api";
import { releasePushToken } from "@/features/settings/notifications";
import { queryKeys } from "@/lib/query-client";
import { isGoogleConfigured, signOutOfGoogle } from "./google-sign-in";
import { clearAccessToken, setAccessToken } from "./token-storage";

/**
 * Seeds the cache from an auth response, so the first screen after sign-in
 * renders without waiting on /auth/me or /addresses.
 *
 * Shared by all three ways in — password, registration and Google — because
 * three copies of it drifted once already.
 */
const seedSession = async (
  queryClient: ReturnType<typeof useQueryClient>,
  data: {
    accessToken: string;
    hasAddress: boolean;
    defaultAddress: unknown;
    user: unknown;
    /** Present on a partner registration. Carried so the route guard sees it. */
    application?: unknown;
  },
) => {
  await setAccessToken(data.accessToken);
  queryClient.setQueryData(queryKeys.accessToken, data.accessToken);
  queryClient.setQueryData(queryKeys.currentUser, {
    data: {
      // Seeded, not left for /auth/me to fill in later: the route guard reads
      // this cache the instant the session flips to signed-in, and without the
      // application it would send a brand-new applicant to the customer home
      // before the real answer arrived.
      application: data.application ?? null,
      defaultAddress: data.defaultAddress,
      hasAddress: data.hasAddress,
      user: data.user,
    },
  });

  if (data.defaultAddress) {
    queryClient.setQueryData(queryKeys.addresses, {
      data: { addresses: [data.defaultAddress] },
    });
  }
};

/**
 * Whether to show the Google button at all.
 *
 * Both ends have to be ready: this build needs a client id, and the server
 * needs the matching one in GOOGLE_CLIENT_IDS. Either missing and the button
 * is hidden rather than shown and then refused — a button that apologises is
 * worse than no button.
 */
export const useGoogleAvailable = (): boolean => {
  const { data } = useQuery({
    queryKey: queryKeys.authProviders,
    queryFn: getAuthProvidersQueryFn,
    enabled: isGoogleConfigured(),
    select: (response) => response.data.google,
    staleTime: Infinity,
  });

  return isGoogleConfigured() && data === true;
};

export const useGoogleSignIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: googleSignInMutationFn,
    onSuccess: (response) => seedSession(queryClient, response.data),
  });
};

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
      // Released before the token is cleared, while the request can still
      // authenticate: otherwise the next person to sign in on this phone keeps
      // receiving the previous account's order updates.
      await releasePushToken();
      // Without this, tapping Google after signing out silently returns the
      // same account with no chooser, which reads as the app ignoring you.
      await signOutOfGoogle();
      await clearAccessToken();
      queryClient.clear();
      router.replace("/welcome");
    },
  });
};
