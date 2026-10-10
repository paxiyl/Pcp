/*
  Whether a customer can pay, decided before they try.

  Two sides own half the answer each. The server knows whether its gateway has
  keys; only the app knows whether that gateway's SDK is compiled into the
  build. Both said yes unconditionally: `getPaymentPreferences` returned
  `available: true` for every non-cash method because "the gateway handles
  them", and the app's Razorpay sheet was a stub that returned a failure. So a
  customer set UPI as their default, filled in an address, a phone number and a
  delivery note, and found out at the Pay button.

  This runs the app's half — `mobile/src/features/payments/availability.ts`,
  which is import-free for exactly this reason — over every combination of the
  two. The server's half is checked over the wire in `api.check.mjs`.
*/
const repo = new URL("../../../../", import.meta.url).pathname;

const { canOpenSheetFor, methodUsable, onlineUsable, openingMethod, withBuildLimits } =
  await import(`${repo}mobile/src/features/payments/availability.ts`);

const checks = [];
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push(pass);
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
};

/** The basket's payment block, as the API sends it. */
const options = (overrides) => ({
  codAvailable: true,
  codMaxOrderValue: 200000,
  onlineAvailable: true,
  ...overrides,
});

const preferences = (overrides) => ({
  cod: { available: true, maxOrderValue: 200000 },
  isExplicit: true,
  methods: [],
  online: { available: true, provider: "razorpay" },
  preferred: "upi",
  ...overrides,
});

console.log("\nWhat this build can open");
check("cash needs no sheet", canOpenSheetFor("cod"), true);
check("Stripe is a dependency", canOpenSheetFor("stripe"), true);
check("Razorpay is not installed yet", canOpenSheetFor("razorpay"), false);

console.log("\nBoth halves have to agree");
check(
  "gateway configured but no SDK in this build",
  onlineUsable(preferences({ online: { available: true, provider: "razorpay" } })),
  false,
);
check(
  "SDK present but gateway has no keys",
  onlineUsable(preferences({ online: { available: false, provider: "stripe" } })),
  false,
);
check(
  "both sides ready",
  onlineUsable(preferences({ online: { available: true, provider: "stripe" } })),
  true,
);
check("no answer yet is not a yes", onlineUsable(undefined), false);

console.log("\nThe basket's options, narrowed by the build");
check(
  "a Razorpay deployment cannot pay online from this build",
  withBuildLimits(options(), preferences()).onlineAvailable,
  false,
);
check(
  "and it says why",
  typeof withBuildLimits(options(), preferences()).onlineUnavailableReason,
  "string",
);
check(
  "a Stripe deployment can",
  withBuildLimits(options(), preferences({ online: { available: true, provider: "stripe" } }))
    .onlineAvailable,
  true,
);
check(
  "the server's own no is left alone, reason and all",
  withBuildLimits(
    options({ onlineAvailable: false, onlineUnavailableReason: "Gateway has no keys" }),
    preferences({ online: { available: false, provider: "stripe" } }),
  ).onlineUnavailableReason,
  "Gateway has no keys",
);

console.log("\nWhether one method can be used");
check("cash when cash is on", methodUsable("cod", options()), true);
check("cash over the ceiling", methodUsable("cod", options({ codAvailable: false })), false);
check("UPI when online is on", methodUsable("upi", options()), true);
check("a card when online is off", methodUsable("card", options({ onlineAvailable: false })), false);

console.log("\nWhich method checkout opens on");
check("the customer's own default", openingMethod("card", options()), "card");
check(
  "a cash default over the ceiling falls to online",
  openingMethod("cod", options({ codAvailable: false })),
  "upi",
);
check(
  "a UPI default with no gateway falls to cash",
  openingMethod("upi", options({ onlineAvailable: false })),
  "cod",
);
check(
  "a card default with no gateway falls to cash",
  openingMethod("card", options({ onlineAvailable: false })),
  "cod",
);
/*
  The state the Pay button must never paper over: no gateway and no cash. Null
  is the honest answer, and checkout says it out loud instead of offering a
  button that fails.
*/
check(
  "neither side works",
  openingMethod("upi", options({ codAvailable: false, onlineAvailable: false })),
  null,
);
check(
  "cash still works when it is the only thing left",
  openingMethod("upi", options({ onlineAvailable: false })),
  "cod",
);

const failed = checks.filter((x) => !x).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed === 0 ? 0 : 1);
