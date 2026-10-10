/*
  Where the app sends you after you sign in.

  The one check that looks at `mobile/` rather than the API, because this
  decision broke twice and neither break was reachable from here. A rider signed
  up, the server correctly filed a pending application and correctly said so in
  the response, and the app put them on the customer shopping page anyway:

    1. The route guard and the sign-up screen both redirected, to two different
       places, and whichever landed last won.
    2. After that was fixed by giving the guard one answer, the answer was read
       from a cache that three mutation hooks wrote by hand — and two of the
       three copies had never been taught to store the application at all, so
       the guard could not see a pending one however hard it looked.

  Both lived in inline ternaries inside hooks, so the only way to run either was
  to build an APK, install it, and sign up on a phone. They are plain functions
  now (`mobile/src/features/auth/routes.ts`) and this runs them. The second half
  of the file checks the two source invariants that made copy 2 possible.
*/
import { readFileSync } from "node:fs";

const repo = new URL("../../../../", import.meta.url).pathname;
const auth = `${repo}mobile/src/features/auth`;

const { landingRouteFor, postAuthRouteFor, redirectFor, groupForRole, ROLE_GROUPS } = await import(
  `${auth}/routes.ts`
);

const checks = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
};

const pending = { status: "pending" };

/* Which front door a role opens on launch. */
console.log("\nLanding route per role");
check("a rider goes to their shift screen", landingRouteFor("driver", true), "/driver-home");
check("a shopkeeper goes to their dashboard", landingRouteFor("store_owner", true), "/store-dashboard");
check("a kitchen owner goes to their counter", landingRouteFor("restaurant_owner", true), "/kitchen-counter");
check("a customer with an address goes shopping", landingRouteFor("customer", true), "/home");
check("a customer without one sets it first", landingRouteFor("customer", false), "/location");
check("an admin on the phone is a customer", landingRouteFor("admin", true), "/home");
check("an unknown role is a customer", landingRouteFor("something-new", true), "/home");
check("no role at all is a customer", landingRouteFor(undefined, true), "/home");

/* A role owns exactly one group, and new roles fall back rather than crash. */
console.log("\nRole to route group");
check("rider", groupForRole("driver"), "(driver)");
check("shopkeeper", groupForRole("store_owner"), "(store)");
check("kitchen owner", groupForRole("restaurant_owner"), "(kitchen)");
check("customer", groupForRole("customer"), "(customer)");
check("admin", groupForRole("admin"), "(customer)");
check("an unknown role waits in the customer app", groupForRole("something-new"), "(customer)");
check("every group has a role that owns it", ROLE_GROUPS.map(groupForRole).length, 4);

/*
  The reported bug. Someone who has just applied is a customer with a pending
  application — the role is NOT what tells them apart, which is exactly how all
  three partner sign-ups ended up on the shopping page.
*/
console.log("\nStraight after authenticating");
check("a new rider applicant is told where it stands", postAuthRouteFor("customer", false, pending), "/application-status");
check("a new shop applicant too", postAuthRouteFor("customer", true, pending), "/application-status");
check("a new kitchen applicant too", postAuthRouteFor("customer", true, pending), "/application-status");
check("a plain new customer sets an address", postAuthRouteFor("customer", false, null), "/location");
check("a plain returning customer goes shopping", postAuthRouteFor("customer", true, null), "/home");
check(
  "an approved rider goes to work, not back to the status screen",
  postAuthRouteFor("driver", true, { status: "approved" }),
  "/driver-home",
);
check(
  "a rejected applicant is not met by the refusal every time",
  postAuthRouteFor("customer", true, { status: "rejected" }),
  "/home",
);
check("no application behaves as none", postAuthRouteFor("customer", true, undefined), "/home");

/* The guard's whole decision, including the states where it must do nothing. */
console.log("\nThe route guard");
const session = (overrides) => ({
  group: "(customer)",
  isResolving: false,
  isSignedIn: true,
  landingRoute: "/home",
  postAuthRoute: "/home",
  ...overrides,
});

check(
  "nothing happens while the stored token is still loading",
  redirectFor(session({ isResolving: true, isSignedIn: false }), "(customer)"),
  null,
);
check("the entry route decides for itself", redirectFor(session(), undefined), null);
check(
  "a signed-out person in the app is sent to the front",
  redirectFor(session({ isSignedIn: false }), "(customer)"),
  "/welcome",
);
check(
  "a signed-out person signing in is left alone",
  redirectFor(session({ isSignedIn: false }), "(auth)"),
  null,
);

/* The regression, at the level the user actually experienced it. */
check(
  "a rider applicant leaving sign-up lands on the status screen",
  redirectFor(session({ postAuthRoute: "/application-status" }), "(auth)"),
  "/application-status",
);
check(
  "a shop applicant leaving sign-up does too",
  redirectFor(session({ postAuthRoute: "/application-status" }), "(auth)"),
  "/application-status",
);
check(
  "an approved rider signing in goes to their shift",
  redirectFor(session({ group: "(driver)", landingRoute: "/driver-home", postAuthRoute: "/driver-home" }), "(auth)"),
  "/driver-home",
);
check(
  "a shopkeeper signing in goes to their dashboard",
  redirectFor(session({ group: "(store)", landingRoute: "/store-dashboard", postAuthRoute: "/store-dashboard" }), "(auth)"),
  "/store-dashboard",
);
check(
  "a kitchen owner signing in goes to their counter",
  redirectFor(session({ group: "(kitchen)", landingRoute: "/kitchen-counter", postAuthRoute: "/kitchen-counter" }), "(auth)"),
  "/kitchen-counter",
);

/* Nobody sits in somebody else's app. */
check(
  "a rider who lands in the customer app is moved",
  redirectFor(session({ group: "(driver)", landingRoute: "/driver-home" }), "(customer)"),
  "/driver-home",
);
check(
  "a customer who lands in the rider app is moved",
  redirectFor(session(), "(driver)"),
  "/home",
);
check(
  "a shopkeeper who lands in the kitchen app is moved",
  redirectFor(session({ group: "(store)", landingRoute: "/store-dashboard" }), "(kitchen)"),
  "/store-dashboard",
);
check("a rider in the rider app is left alone", redirectFor(session({ group: "(driver)" }), "(driver)"), null);
check(
  "an applicant waits in the customer app, not bounced out of it",
  redirectFor(session({ postAuthRoute: "/application-status" }), "(customer)"),
  null,
);

/*
  Shared screens are not policed. A shopkeeper opening payment methods or an
  order detail must stay there — the earlier version of this guard policed every
  group and bounced them back to their counter mid-task.
*/
check(
  "a shopkeeper on a shared screen stays on it",
  redirectFor(session({ group: "(store)", landingRoute: "/store-dashboard" }), "payment-methods"),
  null,
);
check(
  "so does a rider",
  redirectFor(session({ group: "(driver)", landingRoute: "/driver-home" }), "order"),
  null,
);
check(
  "and the status screen itself",
  redirectFor(session({ postAuthRoute: "/application-status" }), "application-status"),
  null,
);

/*
  The invariants behind break 2. One place writes the session cache the guard
  reads, and every way in goes through it. Three hand-written copies is what let
  two of them forget the application.
*/
console.log("\nOne writer, one decision");
const useAuth = readFileSync(`${auth}/use-auth.ts`, "utf8");

check(
  "the session cache has exactly one writer",
  (useAuth.match(/setQueryData\(queryKeys\.currentUser/g) ?? []).length,
  1,
);
check(
  "that writer carries the application",
  /setQueryData\(queryKeys\.currentUser,[\s\S]{0,400}?application:/.test(useAuth),
  true,
);
check(
  "password, registration and Google all go through it",
  (useAuth.match(/onSuccess: \(response\) => seedSession\(/g) ?? []).length,
  3,
);

/* No route literal may live in the guard: an untested branch is how this began. */
const guard = readFileSync(`${auth}/use-protected-route.ts`, "utf8");
check("the guard holds no routes of its own", /"\/[a-z-]/.test(guard), false);

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
