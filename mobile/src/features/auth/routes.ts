/**
 * Where an account belongs, as plain functions over plain values.
 *
 * Deliberately import-free. This is the decision that put a rider on the
 * customer shopping page twice, each time for a different reason, and both
 * times it was an inline ternary inside a hook — reachable only by building an
 * APK and signing up on a phone. As functions over arguments it can be run
 * directly (`src/scripts/checks/mobile-routing.check.mjs`), so the next
 * regression is a failing assertion instead of a message from Hindaun.
 */

/** The roles the one app serves. Admins sign in on the backoffice. */
export type Role = "admin" | "customer" | "driver" | "restaurant_owner" | "store_owner";

/** Every route this module can send somebody to. */
export type AppRoute =
  | "/application-status"
  | "/driver-home"
  | "/home"
  | "/kitchen-counter"
  | "/location"
  | "/store-dashboard"
  | "/welcome";

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

export const groupForRole = (role?: string): string =>
  GROUP_FOR_ROLE[role ?? "customer"] ?? "(customer)";

/**
 * Where a signed-in account belongs on launch.
 *
 * One app, four front doors. The role on the account decides which one opens —
 * not the picker at sign-in, which only states an intention the server then
 * verifies. Riders and shopkeepers never land in the customer app by accident.
 */
export const landingRouteFor = (role?: string, hasAddress?: boolean): AppRoute => {
  if (role === "driver") return "/driver-home" as const;
  if (role === "store_owner") return "/store-dashboard" as const;
  // Was missing, which is why an approved kitchen owner fell through to the
  // customer home: there were no kitchen screens to send them to.
  if (role === "restaurant_owner") return "/kitchen-counter" as const;

  return hasAddress ? ("/home" as const) : ("/location" as const);
};

/**
 * Where to go immediately AFTER authenticating, which is not the same question
 * as where to go on launch.
 *
 * Someone who has just asked to become a shop, kitchen or rider should be told
 * where that request stands — landing them on the customer home is what made
 * signing up look like it had ignored the choice. But on every later launch
 * they are an ordinary customer and should go shopping; the profile row carries
 * the status. So two functions, not one.
 *
 * Only `pending` diverts. An approved application has already changed the role,
 * so the role decides; a rejected one leaves an ordinary customer, who should
 * not be met by a refusal every time they open the app.
 */
export const postAuthRouteFor = (
  role: string | undefined,
  hasAddress: boolean | undefined,
  application: { status?: string } | null | undefined,
): AppRoute =>
  application?.status === "pending" ? "/application-status" : landingRouteFor(role, hasAddress);

/**
 * The route guard's entire decision: what the session knows, plus the group
 * currently on screen, in — a route to replace with, or null to stay put.
 *
 * Extracted from the effect so it can be run. The effect around it used to
 * hold three early returns and two conditions, and the difference between
 * `postAuthRoute` and `landingRoute` in one of those branches was the whole
 * bug; none of it was reachable without an APK and a phone.
 */
export const redirectFor = (
  session: {
    /** The group this ACCOUNT belongs to. */
    group: string;
    isResolving: boolean;
    isSignedIn: boolean;
    landingRoute: AppRoute;
    postAuthRoute: AppRoute;
  },
  /** The group currently ON SCREEN. */
  group: string | undefined,
): AppRoute | null => {
  // Nothing is known yet. Deciding here is how a signed-in person gets bounced
  // to /welcome for a frame while their stored token is still loading.
  if (session.isResolving) return null;

  // The entry route decides for itself on first paint.
  if (group === undefined) return null;

  const inAuthGroup = group === "(auth)";

  if (!session.isSignedIn) return inAuthGroup ? null : "/welcome";

  /*
    `postAuthRoute`, not `landingRoute`.

    This branch and the sign-up screen both redirect after a successful
    registration, and they were going to two DIFFERENT places — the screen to
    /application-status, this to the customer home — so whichever landed last
    won. That is why signing up as a store owner put you on the customer page.

    One answer for "you just authenticated", so the two agree and the order
    stops mattering.
  */
  if (inAuthGroup) return session.postAuthRoute;

  /*
    Roles do not share their home screens: someone in another role's app is
    sent to their own rather than left on a screen the API will refuse.

    Driven by a role-to-group map rather than a chain of `is…` comparisons.
    The chain only ever knew about riders, so a shopkeeper could sit in the
    customer app and a kitchen owner had nowhere to be sent at all — and every
    new role meant another flag and another branch, which is the shape of code
    that forgets one.

    Only the four role-home groups are policed. Onboarding and any pushed
    screen — an order, a product, payment methods — are shared, so an owner
    opening one is left where they are.
  */
  if (ROLE_GROUPS.includes(group) && group !== session.group) return session.landingRoute;

  return null;
};
