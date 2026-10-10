import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { redirectFor } from "./routes";
import { useSession } from "./use-session";

/**
 * Keeps the visible route and the session in agreement.
 *
 * The redirect happens here, in the root layout, rather than inside a group
 * layout: swapping a layout's navigator for a <Redirect> leaves the router on a
 * route whose navigator no longer exists, which wedges the app on a blank screen.
 *
 * The decision itself is `redirectFor`, which is a function over values and is
 * exercised by `api/src/scripts/checks/mobile-routing.check.mjs`. What is left
 * here is only the wiring: read the session, read the segments, navigate.
 */
export const useProtectedRoute = () => {
  const { group, isResolving, isSignedIn, landingRoute, postAuthRoute } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const next = redirectFor(
      { group, isResolving, isSignedIn, landingRoute, postAuthRoute },
      segments[0],
    );

    if (next) router.replace(next);
  }, [group, isResolving, isSignedIn, landingRoute, postAuthRoute, router, segments]);
};
