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
 * Role to route group, so the guard does not have to grow an `is…` flag and a
 * branch for every role. Anything not listed belongs in the customer app.
 */
export const GROUP_FOR_ROLE: Record<string, string> = {
  admin: "(customer)",
  customer: "(customer)",
  driver: "(driver)",
  restaurant_owner: "(kitchen)",
  store_owner: "(store)",
};

/**
 * The four groups that belong to exactly one role, and the only ones the guard
 * polices. Everything else — onboarding, a pushed order or product screen,
 * payment methods — is shared by everybody, so an owner opening one of those
 * must not be bounced back to their counter.
 */
export const ROLE_GROUPS = ["(customer)", "(driver)", "(kitchen)", "(store)"];

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
  // Was missing, which is why an approved kitchen owner fell through to the
  // customer home: there were no kitchen screens to send them to.
  if (role === "restaurant_owner") return "/kitchen-counter" as const;

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
    group: GROUP_FOR_ROLE[user?.role ?? "customer"] ?? "(customer)",
    landingRoute: landingRouteFor(user?.role, userQuery.data?.data.hasAddress),
    /**
     * Where to go immediately AFTER authenticating, which is not the same
     * question as where to go on launch.
     *
     * Someone who has just asked to become a shop, kitchen or rider should be
     * told where that request stands — landing them on the customer home is
     * what made signing up look like it had ignored the choice. But on every
     * later launch they are an ordinary customer and should go shopping; the
     * profile row carries the status. So two routes, not one.
     */
    postAuthRoute:
      application?.status === "pending"
        ? ("/application-status" as const)
        : landingRouteFor(user?.role, userQuery.data?.data.hasAddress),
    application,
    hasAddress: userQuery.data?.data.hasAddress ?? false,
    defaultAddress: userQuery.data?.data.defaultAddress ?? null,
    user: userQuery.data?.data.user,
  };
};
