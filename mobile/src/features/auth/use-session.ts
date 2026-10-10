import { useQuery } from "@tanstack/react-query";

import { getCurrentUserQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";
import { groupForRole, landingRouteFor, postAuthRouteFor } from "./routes";
import { getAccessToken } from "./token-storage";

// Re-exported so callers keep importing "where do I belong" from one place,
// while the decision itself lives in an import-free module a check can run.
export { GROUP_FOR_ROLE, ROLE_GROUPS, landingRouteFor, postAuthRouteFor } from "./routes";

/**
 * One source of truth for "who is signed in and where do they belong".
 *
 * A stored token only means the app *might* be signed in — /auth/me is what
 * proves it. A rejected token is cleared by the axios interceptor, so a 401
 * here resolves to signed-out rather than a retry loop.
 */
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
  const hasAddress = userQuery.data?.data.hasAddress ?? false;
  const application = userQuery.data?.data.application ?? null;

  return {
    isResolving,
    isSignedIn: Boolean(tokenQuery.data) && Boolean(userQuery.data),
    role: user?.role,
    isDriver: user?.role === "driver",
    isStoreOwner: user?.role === "store_owner",
    isKitchenOwner: user?.role === "restaurant_owner",
    /**
     * The one role-home group this account belongs in. An applicant waiting on
     * a decision is still a customer, so they wait in the customer app.
     */
    group: groupForRole(user?.role),
    landingRoute: landingRouteFor(user?.role, hasAddress),
    postAuthRoute: postAuthRouteFor(user?.role, hasAddress, application),
    application,
    hasAddress,
    defaultAddress: userQuery.data?.data.defaultAddress ?? null,
    user,
  };
};
