import { useQuery } from "@tanstack/react-query";

import { getCurrentUserQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { getAccessToken } from "./token-storage";

/**
 * One source of truth for "who is signed in and where do they belong".
 *
 * A stored token only means the app *might* be signed in — /auth/me is what
 * proves it. A rejected token is cleared by the axios interceptor, so a 401
 * here resolves to signed-out rather than a retry loop.
 */
/**
 * Where a signed-in account belongs.
 *
 * One app, three front doors. The role on the account decides which one opens —
 * not the picker at sign-in, which only states an intention the server then
 * verifies. Riders and shopkeepers never land in the customer app by accident.
 */
export const landingRouteFor = (role?: string, hasAddress?: boolean) => {
  if (role === "driver") return "/driver-home" as const;
  if (role === "store_owner") return "/store-dashboard" as const;

  return hasAddress ? ("/home" as const) : ("/location" as const);
};

export const useSession = () => {
  const tokenQuery = useQuery({
    queryKey: queryKeys.accessToken,
    queryFn: getAccessToken,
    staleTime: Infinity,
  });

  const userQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUserQueryFn,
    enabled: Boolean(tokenQuery.data),
    retry: false,
  });

  const isResolving = tokenQuery.isLoading || (Boolean(tokenQuery.data) && userQuery.isLoading);

  const user = userQuery.data?.data.user;

  return {
    isResolving,
    isSignedIn: Boolean(tokenQuery.data) && Boolean(userQuery.data),
    role: user?.role,
    isDriver: user?.role === "driver",
    isStoreOwner: user?.role === "store_owner",
    landingRoute: landingRouteFor(user?.role, userQuery.data?.data.hasAddress),
    hasAddress: userQuery.data?.data.hasAddress ?? false,
    defaultAddress: userQuery.data?.data.defaultAddress ?? null,
    user: userQuery.data?.data.user,
  };
};
