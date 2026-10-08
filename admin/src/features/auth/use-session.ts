import { useQuery } from "@tanstack/react-query";

import { getCurrentUserQueryFn } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * One source of truth for "who is signed in".
 *
 * The token lives in an HTTP-only cookie the browser sends automatically, so
 * there is nothing to read locally: /auth/me is what proves a session. A 401 is
 * a definitive answer, not a transient failure, so it is never retried.
 */
export const useSession = () => {
  const query = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUserQueryFn,
    retry: false,
    select: (response) => response.data.user,
  });

  const user = query.data;

  return {
    isResolving: query.isLoading,
    isSignedIn: Boolean(user),
    // The backoffice is admin-only; any other role is treated as no access.
    isAdmin: user?.role === "admin",
    user,
  };
};
