import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { ROLE_GROUPS, useSession } from "./use-session";

/**
 * Keeps the visible route and the session in agreement.
 *
 * The redirect happens here, in the root layout, rather than inside a group
 * layout: swapping a layout's navigator for a <Redirect> leaves the router on a
 * route whose navigator no longer exists, which wedges the app on a blank screen.
 */
export const useProtectedRoute = () => {
  const { group: ownGroup, isResolving, isSignedIn, landingRoute, postAuthRoute } = useSession();
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
      /*
        `postAuthRoute`, not `landingRoute`.

        This branch and the sign-up screen were both redirecting after a
        successful registration, to two DIFFERENT places — the screen to
        /application-status, this to the customer home — and whichever landed
        last won. Which is why signing up as a store owner put you on the
        customer page even with the fix in place.

        One answer for "you just authenticated" now, so the two agree and the
        order stops mattering.
      */
      router.replace(postAuthRoute);
      return;
    }

    if (!isSignedIn) return;

    /*
      Roles do not share their home screens: someone in another role's app is
      sent to their own rather than left on a screen the API will refuse.

      Driven by a role-to-group map rather than a chain of `is…` comparisons.
      The chain only ever knew about riders, so a shopkeeper could sit in the
      customer app and a kitchen owner had nowhere to be sent at all — and
      every new role meant another flag and another branch, which is the shape
      of code that forgets one.

      Only the four role-home groups are policed. Onboarding and any pushed
      screen — an order, a product, payment methods — are shared, so an owner
      opening one is left where they are.
    */
    if (ROLE_GROUPS.includes(group) && group !== ownGroup) {
      router.replace(landingRoute);
    }
  }, [isResolving, isSignedIn, landingRoute, ownGroup, postAuthRoute, router, segments]);
};
