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

## Running them

They need `mongodb-memory-server`, which downloads a MongoDB binary on first
run and is deliberately not a dependency of the API:

    npm install --no-save mongodb-memory-server
    npx tsx src/scripts/checks/settlement.check.mjs
    npx tsx src/scripts/checks/order-hooks.check.mjs
    npx tsx src/scripts/checks/register.check.mjs
    npx tsx src/scripts/checks/seed.check.mjs

Each exits non-zero on the first failing assertion and prints every result, so
the output reads as a list of what is true rather than a pass/fail.
