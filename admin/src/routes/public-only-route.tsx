import { Navigate, Outlet } from "react-router";

import { useSession } from "@/features/auth/use-session";
import { SessionLoading } from "./session-boundary";

/** Keeps a signed-in admin off the login screen. */
export function PublicOnlyRoute() {
  const { isAdmin, isResolving } = useSession();

  if (isResolving) return <SessionLoading />;
  if (isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
