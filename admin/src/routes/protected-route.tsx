import { Navigate, Outlet, useLocation } from "react-router";

import { useSession } from "@/features/auth/use-session";
import { SessionLoading } from "./session-boundary";

/**
 * Guards the backoffice. Signed out sends you to login and remembers where you
 * were headed; signed in as a customer or rider is a 403, not a login prompt,
 * because logging in again would not help.
 */
export function ProtectedRoute() {
  const { isAdmin, isResolving, isSignedIn } = useSession();
  const location = useLocation();

  if (isResolving) return <SessionLoading />;
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <Navigate to="/no-access" replace />;

  return <Outlet />;
}
