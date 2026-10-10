/*
  Boots the real server against a throwaway MongoDB and calls every endpoint a
  client actually uses, checking the status and the KEYS in the response.

  This exists because of the search bug: the controller fetched products,
  stores, restaurants and dishes, then returned only two of the four. The
  mobile types declared all four, so the app read `data.products` as undefined
  and every grocery search came back empty — and nothing in a typecheck or a
  unit test could see it, because the two halves agree only by hand across two
  codebases.

  So this asserts the hand-agreement, over the wire, through the real
  middleware stack: helmet, the rate limiters, passport, the error handler.
*/
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

/*
  A random high port, not a fixed one.

  The first version pinned 8111, and because the teardown below used to kill
  only the `npx` wrapper and not the node process under it, a server from a
  previous run stayed bound to that port. The next run's server then failed to
  bind and exited — while the STALE one happily answered /health, so the check
  thought it was ready and talked to a server whose database no longer existed.
  Every call failed and none of it was the app's fault.
*/
const PORT = 8100 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri("apicheck");

const env = {
  ...process.env,
  CORS_ORIGIN: "http://localhost:5173",
  JWT_SECRET: "check-only-secret-long-enough-to-pass",
  LOG_LEVEL: "error",
  MONGODB_URI: uri,
  NODE_ENV: "development",
  PORT: String(PORT),
};

const api = new URL("../..", import.meta.url).pathname;

/* ---------------------------------------------------------------- seeding -- */

const run = (script, args = []) =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", `${api}/scripts/${script}`, ...args], {
      env,
      stdio: "ignore",
    });

    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} → ${code}`))));
  });

console.log("Seeding…");
await run("seed-categories.ts");
await run("seed-restaurants.ts");
await run("seed-stores.ts");
await run("seed-admin.ts", ["--email", "admin@check.local", "--password", "check-password-123"]);

/* ----------------------------------------------------------------- server -- */

/** Refuses to start on an occupied port rather than trusting someone else's. */
const portIsFree = async () => {
  try {
    await fetch(`http://127.0.0.1:${PORT}/health`, { signal: AbortSignal.timeout(1000) });

    return false;
  } catch {
    return true;
  }
};

if (!(await portIsFree())) {
  console.error(`Something is already listening on ${PORT}. Refusing to test against it.`);
  await mongod.stop();
  process.exit(1);
}

console.log(`Starting the API on ${PORT}…`);
// `detached` puts it in its own process group, so the teardown can take the
// whole group down — killing `npx` alone leaves the node child running.
const server = spawn("npx", ["tsx", `${api}/index.ts`], {
  detached: true,
  env,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));

const ready = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);

      if (response.ok) return true;
    } catch {
      // Not up yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
};

if (!(await ready())) {
  console.error("The API never came up:\n", serverLog);

  try {
    process.kill(-server.pid, "SIGKILL");
  } catch {
    // Never started.
  }

  await mongod.stop();
  process.exit(1);
}

/* ------------------------------------------------------------------ checks -- */

const checks = [];
const fails = [];

const record = (label, ok, detail) => {
  checks.push(ok);
  if (!ok) fails.push(`${label} — ${detail}`);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` → ${detail}`}`);
};

/**
 * Calls an endpoint and asserts the status, then that every named key is
 * present in `data`. Presence, not shape: a key the client reads and the
 * server never sends is the bug this is hunting.
 */
const expectKeys = async (label, url, keys, options = {}) => {
  const { status = 200, token, method = "GET", body } = options;

  let response;

  try {
    response = await fetch(url.startsWith("http") ? url : `${BASE}${url}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      method,
    });
  } catch (error) {
    record(label, false, `request failed: ${error.message}`);

    return null;
  }

  if (response.status !== status) {
    const text = await response.text();

    record(label, false, `expected ${status}, got ${response.status}: ${text.slice(0, 160)}`);

    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!payload) {
    record(label, false, "response was not JSON");

    return null;
  }

  const data = payload.data ?? {};
  const missing = keys.filter((key) => !(key in data));

  record(label, missing.length === 0, `missing key(s): ${missing.join(", ")}`);

  return data;
};

/* Public catalogue — what the app loads before anyone signs in. */
await expectKeys("GET /categories", "/categories", ["categories"]);
await expectKeys("GET /restaurants", "/restaurants", ["restaurants"]);
await expectKeys("GET /stores", "/stores", ["stores"]);
await expectKeys("GET /products", "/products", ["products"]);
await expectKeys("GET /product-categories", "/product-categories", ["categories"]);
await expectKeys("GET /banners/active", "/banners/active", ["banners"]);
await expectKeys("GET /image-presets", "/image-presets", ["presets", "uploadsEnabled"]);
await expectKeys("GET /auth/providers", "/auth/providers", ["google"]);

/* Search: all four groups, which is the bug this file was written for. */
const grocery = await expectKeys("GET /search (grocery)", "/search?q=atta&mode=grocery", [
  "query",
  "products",
  "stores",
  "restaurants",
  "dishes",
]);

record(
  "search actually finds seeded products",
  Array.isArray(grocery?.products) && grocery.products.length > 0,
  `products: ${grocery?.products?.length ?? "n/a"}`,
);

const food = await expectKeys("GET /search (food)", "/search?q=biryani&mode=food", [
  "products",
  "stores",
  "restaurants",
  "dishes",
]);

record(
  "search finds seeded kitchens and dishes",
  (food?.restaurants?.length ?? 0) + (food?.dishes?.length ?? 0) > 0,
  `kitchens: ${food?.restaurants?.length}, dishes: ${food?.dishes?.length}`,
);

/* An unmet search is recorded rather than lost. */
await expectKeys(
  "POST /search/requests",
  "/search/requests",
  ["term", "mode"],
  { body: { mode: "food", term: "sushi" }, method: "POST" },
);

/* Registration, including as a partner. */
const customer = await expectKeys(
  "POST /auth/register (customer)",
  "/auth/register",
  ["accessToken", "user", "hasAddress", "defaultAddress"],
  {
    body: {
      email: "shopper@check.local",
      name: "Check Shopper",
      password: "password1234",
    },
    method: "POST",
    status: 201,
  },
);

record("a plain signup is a customer", customer?.user?.role === "customer", customer?.user?.role);

const kitchen = await expectKeys(
  "POST /auth/register (kitchen)",
  "/auth/register",
  ["accessToken", "user", "application"],
  {
    body: {
      businessName: "Check Tandoori",
      email: "kitchen@check.local",
      joinAs: "restaurant_owner",
      name: "Check Kitchen",
      password: "password1234",
      phone: "9876543210",
    },
    method: "POST",
    status: 201,
  },
);

record(
  "a kitchen signup files a pending application",
  kitchen?.application?.status === "pending" &&
    kitchen?.application?.requestedRole === "restaurant_owner",
  JSON.stringify({ role: kitchen?.application?.requestedRole, status: kitchen?.application?.status }),
);

record("a kitchen signup is still a customer", kitchen?.user?.role === "customer", kitchen?.user?.role);

/* The duplicate email that used to burn the rate-limit budget. */
await expectKeys(
  "POST /auth/register (duplicate email refused)",
  "/auth/register",
  [],
  {
    body: { email: "shopper@check.local", name: "Again", password: "password1234" },
    method: "POST",
    status: 400,
  },
);

/* Signed-in customer surfaces. */
const token = customer?.accessToken;

await expectKeys("GET /auth/me", "/auth/me", ["user", "hasAddress", "defaultAddress"], { token });

/*
  The route guard decides where a just-authenticated account belongs from this
  field. Without it the guard and the sign-up screen redirected to two
  different places and whichever landed last won — which is why signing up as a
  store owner still showed the customer page.
*/
const kitchenToken = kitchen?.accessToken;

const kitchenMe = await expectKeys(
  "GET /auth/me reports the pending application",
  "/auth/me",
  ["user", "application"],
  { token: kitchenToken },
);

record(
  "the applicant's /auth/me carries a pending application",
  kitchenMe?.application?.status === "pending" &&
    kitchenMe?.application?.requestedRole === "restaurant_owner",
  JSON.stringify(kitchenMe?.application ?? null),
);

const shopperMe = await expectKeys(
  "a plain customer's /auth/me has no application",
  "/auth/me",
  ["user", "application"],
  { token },
);

// `record` takes a boolean, not the value — passing null as the flag made this
// report a failure while printing the expected answer.
record(
  "a plain customer's application is null",
  shopperMe?.application === null,
  JSON.stringify(shopperMe?.application),
);
await expectKeys("GET /addresses", "/addresses", ["addresses"], { token });
await expectKeys("GET /basket", "/basket", ["basket", "totals", "payment"], { token });
await expectKeys("GET /orders", "/orders", ["orders"], { token });
await expectKeys("GET /payment-methods", "/payment-methods", ["preferred", "methods", "cod"], {
  token,
});
await expectKeys("GET /partner-applications/mine", "/partner-applications/mine", ["application"], {
  token,
});

await expectKeys(
  "PATCH /payment-methods",
  "/payment-methods",
  ["preferred", "methods"],
  { body: { method: "cod" }, method: "PATCH", token },
);

/* Signed-out must be refused, not served. */
await expectKeys("GET /auth/me without a token is 401", "/auth/me", [], { status: 401 });
await expectKeys("GET /basket without a token is 401", "/basket", [], { status: 401 });
await expectKeys("GET /admin/settlements/outstanding needs auth", "/admin/settlements/outstanding", [], {
  status: 401,
});

/* A customer must not reach an admin or owner surface. */
await expectKeys("a customer cannot read admin orders", "/admin/orders", [], {
  status: 403,
  token,
});
await expectKeys("a customer cannot reach the store counter", "/store-owner/overview", [], {
  status: 403,
  token,
});
await expectKeys("a customer cannot reach the kitchen counter", "/restaurant-owner/overview", [], {
  status: 403,
  token,
});
await expectKeys("a customer cannot reach the rider queue", "/driver/home", [], {
  status: 403,
  token,
});

/* Admin surfaces, through a real login. */
const admin = await expectKeys(
  "POST /auth/login (admin, no intendedRole)",
  "/auth/login",
  ["accessToken", "user"],
  {
    body: { email: "admin@check.local", password: "check-password-123" },
    method: "POST",
  },
);

record("the admin login returns an admin", admin?.user?.role === "admin", admin?.user?.role);

const adminToken = admin?.accessToken;

await expectKeys("GET /admin/orders", "/admin/orders", ["orders"], { token: adminToken });
await expectKeys("GET /admin/customers", "/admin/customers", ["customers"], { token: adminToken });
await expectKeys("GET /admin/riders", "/admin/riders", ["riders"], { token: adminToken });
await expectKeys("GET /admin/restaurants", "/admin/restaurants", ["restaurants"], {
  token: adminToken,
});
await expectKeys("GET /admin/settings", "/admin/settings", ["settings"], { token: adminToken });
// Every key admin/src/lib/api.ts declares on `Overview`. A dashboard that
// renders nine panels from nine keys is exactly where a dropped one hides.
await expectKeys(
  "GET /admin/analytics/overview",
  "/admin/analytics/overview?days=7",
  [
    "today",
    "yesterday",
    "series",
    "byStatus",
    "recent",
    "activity",
    "liveOrders",
    "vendorSplit",
    "paymentSplit",
  ],
  { token: adminToken },
);
await expectKeys("GET /admin/partner-applications", "/admin/partner-applications", ["applications"], {
  token: adminToken,
});
await expectKeys("GET /admin/demand", "/admin/demand", ["signals"], { token: adminToken });
await expectKeys(
  "GET /admin/settlements/outstanding",
  "/admin/settlements/outstanding",
  ["riders", "vendors", "totals"],
  { token: adminToken },
);
await expectKeys("GET /admin/settlements/history", "/admin/settlements/history", ["settlements"], {
  token: adminToken,
});
await expectKeys("GET /admin/store-owners", "/admin/store-owners", ["owners"], {
  token: adminToken,
});

/* The demand signal recorded above must be visible to the admin. */
const demand = await expectKeys("demand list is not empty", "/admin/demand", ["signals"], {
  token: adminToken,
});

record(
  "the unmet search reached the admin list",
  (demand?.signals ?? []).some((signal) => signal.term === "sushi"),
  `terms: ${(demand?.signals ?? []).map((s) => s.term).join(", ") || "none"}`,
);

/* An admin must not be able to sign in to the APP. */
await expectKeys(
  "an admin cannot sign in to the app",
  "/auth/login",
  [],
  {
    body: {
      email: "admin@check.local",
      intendedRole: "customer",
      password: "check-password-123",
    },
    method: "POST",
    status: 401,
  },
);

/* A role mismatch is refused. */
await expectKeys(
  "a customer cannot sign in as a rider",
  "/auth/login",
  [],
  {
    body: { email: "shopper@check.local", intendedRole: "driver", password: "password1234" },
    method: "POST",
    status: 401,
  },
);

/* Approving the kitchen application grants the role and opens its surfaces. */
const applications = await expectKeys(
  "the kitchen application is in the admin queue",
  "/admin/partner-applications?status=pending",
  ["applications"],
  { token: adminToken },
);

const pending = (applications?.applications ?? []).find(
  (application) => application.requestedRole === "restaurant_owner",
);

if (pending) {
  await expectKeys(
    "PATCH approves the kitchen application",
    `/admin/partner-applications/${pending._id}`,
    ["application"],
    { body: { status: "approved" }, method: "PATCH", token: adminToken },
  );

  const owner = await expectKeys(
    "the approved owner can sign in as a kitchen",
    "/auth/login",
    ["accessToken", "user"],
    {
      body: {
        email: "kitchen@check.local",
        intendedRole: "restaurant_owner",
        password: "password1234",
      },
      method: "POST",
    },
  );

  record(
    "approval granted the kitchen role",
    owner?.user?.role === "restaurant_owner",
    owner?.user?.role,
  );

  const ownerToken = owner?.accessToken;

  await expectKeys(
    "GET /restaurant-owner/overview",
    "/restaurant-owner/overview",
    ["restaurant", "openOrders", "today", "unavailable"],
    { token: ownerToken },
  );
  await expectKeys("GET /restaurant-owner/orders", "/restaurant-owner/orders", ["orders"], {
    token: ownerToken,
  });
  await expectKeys("GET /restaurant-owner/dishes", "/restaurant-owner/dishes", ["dishes"], {
    token: ownerToken,
  });
  await expectKeys(
    "PATCH /restaurant-owner/open",
    "/restaurant-owner/open",
    ["restaurant"],
    { body: { isOpen: false }, method: "PATCH", token: ownerToken },
  );
  await expectKeys("a kitchen owner cannot reach the shop counter", "/store-owner/overview", [], {
    status: 403,
    token: ownerToken,
  });
} else {
  record("the kitchen application is in the admin queue", false, "no pending application found");
}

/* A seeded restaurant detail page, which the app opens by slug. */
const restaurants = await expectKeys("GET /restaurants for a slug", "/restaurants", ["restaurants"]);
// A SEEDED kitchen, not whichever sorted first: this check's own approval flow
// mints "Check Tandoori", which legitimately has no menu yet.
const slug = (restaurants?.restaurants ?? []).find((r) => r.slug?.includes("hindaun-tandoori"))
  ?.slug;

if (slug) {
  const detail = await expectKeys(
    `GET /restaurants/${slug}`,
    `/restaurants/${slug}`,
    ["restaurant", "dishes"],
  );

  record(
    "a seeded kitchen has dishes with a veg mark",
    (detail?.dishes ?? []).length > 0 &&
      detail.dishes.every((dish) => typeof dish.isVeg === "boolean"),
    `dishes: ${detail?.dishes?.length}, marked: ${(detail?.dishes ?? []).filter((d) => typeof d.isVeg === "boolean").length}`,
  );

  record(
    "a seeded dish carries its preset tile",
    (detail?.dishes ?? []).every((dish) => Boolean(dish.imagePreset || dish.imageUrl)),
    `without an image: ${(detail?.dishes ?? []).filter((d) => !d.imagePreset && !d.imageUrl).map((d) => d.name).join(", ") || "none"}`,
  );
}

/* The shop counter and the rider queue, through real approvals. The kitchen
   path above is covered; these are the other two roles, and a surface nobody
   checks is a surface that breaks quietly. */
const shopOwner = await expectKeys(
  "POST /auth/register (shop)",
  "/auth/register",
  ["accessToken", "application"],
  {
    body: {
      businessName: "Check Kirana",
      email: "shop@check.local",
      joinAs: "store_owner",
      name: "Check Shop",
      password: "password1234",
      phone: "9876543212",
    },
    method: "POST",
    status: 201,
  },
);

const rider = await expectKeys(
  "POST /auth/register (rider)",
  "/auth/register",
  ["accessToken", "application"],
  {
    body: {
      email: "rider@check.local",
      joinAs: "driver",
      name: "Check Rider",
      password: "password1234",
      phone: "9876543213",
      vehicle: "Splendor",
    },
    method: "POST",
    status: 201,
  },
);

record("a rider application needs no business name", Boolean(rider?.application), "filed");

const queue = await expectKeys(
  "the shop and rider applications are queued",
  "/admin/partner-applications?status=pending",
  ["applications"],
  { token: adminToken },
);

for (const role of ["store_owner", "driver"]) {
  const application = (queue?.applications ?? []).find((a) => a.requestedRole === role);

  if (!application) {
    record(`approve the ${role} application`, false, "not found in the queue");
    continue;
  }

  await expectKeys(
    `PATCH approves the ${role} application`,
    `/admin/partner-applications/${application._id}`,
    ["application"],
    { body: { status: "approved" }, method: "PATCH", token: adminToken },
  );
}

const shopSession = await expectKeys(
  "the approved shop owner can sign in",
  "/auth/login",
  ["accessToken", "user"],
  {
    body: {
      email: "shop@check.local",
      intendedRole: "store_owner",
      password: "password1234",
    },
    method: "POST",
  },
);

record("approval granted the shop role", shopSession?.user?.role === "store_owner", shopSession?.user?.role);

if (shopSession?.accessToken) {
  const shopToken = shopSession.accessToken;

  await expectKeys(
    "GET /store-owner/overview",
    "/store-owner/overview",
    ["store", "openOrders", "today", "lowStock", "outOfStock"],
    { token: shopToken },
  );
  await expectKeys("GET /store-owner/orders", "/store-owner/orders", ["orders"], {
    token: shopToken,
  });
  await expectKeys("GET /store-owner/products", "/store-owner/products", ["products"], {
    token: shopToken,
  });
  await expectKeys("a shop owner cannot reach the kitchen counter", "/restaurant-owner/overview", [], {
    status: 403,
    token: shopToken,
  });
}

const riderSession = await expectKeys(
  "the approved rider can sign in",
  "/auth/login",
  ["accessToken", "user"],
  {
    body: { email: "rider@check.local", intendedRole: "driver", password: "password1234" },
    method: "POST",
  },
);

record("approval granted the rider role", riderSession?.user?.role === "driver", riderSession?.user?.role);

if (riderSession?.accessToken) {
  const riderToken = riderSession.accessToken;

  const home = await expectKeys(
    "GET /driver/home",
    "/driver/home",
    ["active", "ready", "summary"],
    { token: riderToken },
  );

  // Added with the settlement ledger; a rider has to see what they are holding.
  record(
    "the rider summary carries the cash balance",
    typeof home?.summary?.cashToHandOver === "number" &&
      typeof home?.summary?.unsettledDeliveries === "number",
    JSON.stringify(home?.summary),
  );

  await expectKeys(
    "PATCH /driver/online",
    "/driver/online",
    ["isOnline"],
    { body: { isOnline: true }, method: "PATCH", token: riderToken },
  );
}

/* A 404 must be a clean JSON 404, not an HTML error page or a crash. */
await expectKeys("an unknown route is a clean 404", "/does-not-exist", [], { status: 404 });

/* --------------------------------------------------------------- teardown -- */

/** Takes down the whole process group; the node child is not `server` itself. */
const stopServer = () => {
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    try {
      process.kill(-server.pid, signal);
    } catch {
      // Already gone.
    }
  }
};

stopServer();
await new Promise((resolve) => setTimeout(resolve, 500));
await mongod.stop();

const failed = checks.filter((ok) => !ok).length;

if (failed > 0) {
  console.log("\nFailures:");
  for (const line of fails) console.log(`  ${line}`);
}

console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
