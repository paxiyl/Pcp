# Checks

Scripts that exercise logic against a real MongoDB rather than a mock, for the
places where reading the code is not the same as running it.

They are not a test suite — there is no runner, no assertions library and no
coverage goal. They exist because two kinds of bug in this codebase cannot be
caught by reading:

- **Arithmetic that moves money.** `settlement.check.mjs` walks the cash
  ledger: cash collected against earnings, the prepaid case flipping a rider's
  balance, an uncollected cash order NOT being billed to the rider, in-flight
  orders staying out, the stale-figure refusal, and both legs of an order
  settling independently. A wrong sign here costs a real person real money.

- **Things that only break at runtime.** `order-hooks.check.mjs` walks an order
  through every status with no Firebase configured, because the notification
  hook sits on the save path and a throw there would break status updates
  everywhere. The same run found an import cycle (`order.model` →
  `notification.service` → `user.model` → `order.model`) that TypeScript
  compiled happily and that crashed or not depending on which model Node
  loaded first.

- **Data that has to be true before anything else works.**
  `register.check.mjs` walks signing up as a shop, a kitchen and a rider: the
  account stays a customer, the application exists and is pending, a nameless
  kitchen leaves no orphan account behind, and approval grants the role and
  mints the venue. `seed.check.mjs` runs the real seeders in the order an
  operator runs them and inspects what landed — it caught a preset key that did
  not exist and kitchens being filed under no category at all when
  `seed:categories` had not been run first, both of which typecheck perfectly.

- **The whole API, over the wire.** `api.check.mjs` boots the real server
  against a throwaway MongoDB, seeds it, and calls every endpoint a client
  uses — through the actual middleware stack. All four roles register, get
  approved by an admin, sign in, and are checked for reaching only their own
  surfaces. 99 assertions. It exists because of the search bug: the controller
  fetched four result groups and returned two, and the two halves of that
  contract live in different codebases and agree only by hand.

- **Whether a customer can pay.** `payment-availability.check.mjs` runs the
  app's half of that question (`mobile/src/features/payments/availability.ts`,
  import-free for this reason) over every combination of gateway configuration,
  cash ceiling and compiled-in SDK. Both sides used to say yes unconditionally:
  the server returned `available: true` for every non-cash method because "the
  gateway handles them", and the app's Razorpay sheet was a stub that returned a
  failure. So a customer set UPI as their default, filled in an address, a phone
  number and a delivery note, and found out at the Pay button. The server's half
  is asserted over the wire in `api.check.mjs`.

- **Money crossing the boundary.** `money.check.mjs` runs `parseRupees` and
  `formatPrice` against each other, including the round trip. Neither fails
  loudly: read "120" as 120 instead of 12000 and a shop sells atta for ₹1.20
  until a customer notices, `Number("120.5") * 100` is 12050.000000000002, and
  Hermes ships a trimmed ICU on some Android builds, so Indian digit grouping is
  done by hand and could silently become the Western one.

- **Paths that do not exist.** `route-coverage.check.mjs` reads the API's route
  table off the real Express routers, reads every `API.get/post/patch/put/delete`
  call out of the two clients' API modules, and compares them. `API.get("/banners")`
  typechecks, returns the declared type, and 404s forever — the path is
  `/banners/active`. It also fails on a route file nobody mounts and on the same
  method and path registered twice, and prints the routes neither client calls,
  which is how the owner catalogue gap surfaced: the API has had create and
  delete for products and dishes all along and no screen ever called them.

- **Where the app sends you.** `mobile-routing.check.mjs` is the one check that
  reads `mobile/` rather than the API, because the decision it covers broke
  twice and neither break was visible from this side. The server filed a
  rider's application correctly and said so in the response; the app put them on
  the customer shopping page anyway — first because the guard and the sign-up
  screen redirected to two different places, then because the guard read the
  answer from a cache three hooks wrote by hand, two of which never stored the
  application at all. Both lived in ternaries inside hooks, so running either
  meant building an APK and signing up on a phone. The decision is plain
  functions now and this calls them, every role against every application
  state, plus the two source invariants that allowed the second break: one
  writer for the session cache, and no route literals in the guard.

- **Bug classes, swept mechanically.** `schema-drift.check.mjs` compares every
  model's TypeScript interface against the paths Mongoose actually registered —
  that is the `isVeg` bug, declared and required and never persisted.
  `import-cycles.check.mjs` walks the value-import graph and then loads each
  model first in its own process, which is the property that differed between a
  working boot and `Cannot access 'PAYMENT_METHODS' before initialization`.
  `reset.check.mjs` runs `reset:demo` and asserts no owner is left pointing at a
  shop it deleted; its unlink used a bare `$exists`, which `sanitizeFilter`
  casts to a literal, so it matched nothing and reported success.

## Running them

They need `mongodb-memory-server`, which downloads a MongoDB binary on first
run and is deliberately not a dependency of the API:

    npm install --no-save mongodb-memory-server
    npx tsx src/scripts/checks/settlement.check.mjs
    npx tsx src/scripts/checks/order-hooks.check.mjs
    npx tsx src/scripts/checks/register.check.mjs
    npx tsx src/scripts/checks/seed.check.mjs
    npx tsx src/scripts/checks/reset.check.mjs
    npx tsx src/scripts/checks/schema-drift.check.mjs
    npx tsx src/scripts/checks/import-cycles.check.mjs
    npx tsx src/scripts/checks/api.check.mjs

`mobile-routing.check.mjs` is the exception: it needs no database and no
network, so it runs on its own in well under a second.

    npx tsx src/scripts/checks/mobile-routing.check.mjs

The last one boots a server on a random high port and tears down its own
process group; the others need nothing running.

Each exits non-zero on the first failing assertion and prints every result, so
the output reads as a list of what is true rather than a pass/fail.
