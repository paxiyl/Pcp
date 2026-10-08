import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { useSession } from "./use-session";

/**
 * Keeps the visible route and the session in agreement.
 *
 * The redirect happens here, in the root layout, rather than inside a group
 * layout: swapping a layout's navigator for a <Redirect> leaves the router on a
 * route whose navigator no longer exists, which wedges the app on a blank screen.
 */
export const useProtectedRoute = () => {
  const { isDriver, isResolving, isSignedIn, landingRoute } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isResolving) return;

    const group = segments[0];
    // The entry route decides for itself on first paint.
    if (group === undefined) return;

    const inAuthGroup = group === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/welcome");
      return;
    }

    if (isSignedIn && inAuthGroup) {
      router.replace(landingRoute);
      return;
    }

    // Roles do not share screens: a rider in the customer app (or the reverse)
    // is sent to their own side rather than left on a screen the API will refuse.
    const inDriverGroup = group === "(driver)";

    if (isSignedIn && isDriver !== inDriverGroup) {
      router.replace(landingRoute);
    }
  }, [isDriver, isResolving, isSignedIn, landingRoute, router, segments]);
};
