# OnlineMall (Hindaun) — transformation plan

Status: Phases 1–5 complete, plus onboarding. Ready to seed and run a pilot.
Last updated: 2026-10-06

Turns the Chowly food-delivery platform into a local quick-commerce marketplace for
Hindaun City, Rajasthan, selling groceries, daily essentials, food, household goods,
personal care and electronics — **alongside** the existing restaurant ordering, which
stays.

## Decisions taken

| Question | Answer |
| --- | --- |
| Codebase | This repo (Expo + MongoDB). The original brief described a different stack; it was generic. |
| Domain | **Products alongside restaurants**, across every department: groceries, medicine, cosmetics, clothing, baby, stationery, pet, electronics. |
| Money | **INR, paise as the minor unit.** Razorpay for UPI, cards and COD. |

## Phase 1 — Foundation ✅ complete

Design system, branding and the commerce primitives that everything else composes
from. Detail in [`docs/design/onlinemall-design.md`](../design/onlinemall-design.md).

- Token system rewritten green-led with warm neutral surfaces, offer/delivery/info
  roles added. **Strict superset of the old theme** — verified no token was removed,
  so none of the 71 existing mobile files can break on a missing utility.
- INR formatting with correct Indian digit grouping. Verified: `₹12,34,567.89`,
  `₹1,00,000`, `₹45`.
- Motion language, press primitive, haptics seam.
- `ProductCard` + `QuantityStepper` built.
- Branding swept across mobile and admin. **Storage keys `chowly.accessToken` and
  `chowly.theme` deliberately left alone** — renaming them signs out every installed
  user for no user-visible gain.
- Admin recoloured (oklch converted from the same hexes) and its wordmark rebuilt.

### Carried forward from Phase 1

- `expo-haptics` is not installed, so `lib/haptics.ts` is a no-op. One command and
  three function bodies to enable: `npx expo install expo-haptics`.
- `app.json` identifiers changed: `in.onlinemall.hindaun` for both platforms, and
  the EAS `projectId` and `owner` were **blanked rather than guessed** — they pointed
  at the original author's account. Run `eas init` before the next cloud build.
- Unused now: `assets/images/logo-mark-teal.png`, `logo-mark-white.png`. The app
  icon and splash artwork still ship the old teal mark and need redrawing.

## Phase 2 — Product catalogue ✅ complete

### A decision reversed

Phase 1's plan said the basket should hold items from several stores at once, and
called that the one breaking change. **That was wrong and was not built.**

Every quick-commerce operation this product is modelled on — Zepto, Blinkit,
Instamart — fulfils an order from a single location. The multi-vendor basket is
not a schema problem, it is an operations problem: one rider collecting from three
counters, three payout splits, and partial cancellation when one shop is out of
something. None of that exists here, and building the storage for it without the
operations behind it would have been a migration bought for nothing.

So: **one vendor per basket**, as before, but the vendor is now polymorphic.
Crucially, each line item still carries its own `storeId`/`restaurantId`. Allowing
several vendors later means deleting a check in `resetIfVendorChanged` and
splitting the order by that field — a change to two functions, not a migration of
every open basket.

### What shipped

**Models.** `store.model.ts`, `product.model.ts`, `product-category.model.ts`.
- MRP and selling price are stored separately; the discount is always derived, so
  a badge can never disagree with the price beside it. A `pre("validate")` hook
  clamps an MRP below the price, since that is a data-entry mistake that would
  render a negative discount.
- `stock` and `maxPerOrder` are real and cap the stepper.
- Product slug is unique per store, not globally — two kiranas may both stock
  `aashirvaad-atta-5kg`.
- Categories nest exactly one level; deeper is rejected, because a third level has
  no navigation design and would produce unreachable categories.

**Basket and order generalised.** `restaurantId` was `required: true` on both. It
could not stay, so the invariant moved into a `pre("validate")` hook on each:
exactly one vendor reference, matching the declared kind. `vendorKind` defaults to
`"restaurant"`, so **every basket and order written before this change reads back
correctly with no migration**.

The `order.restaurant*` fields are now the vendor snapshot for both kinds — a store
order fills them with the store's name, image and address. The names are
historical. Renaming them would have touched the admin dashboard, the driver app
and every order screen for no behavioural gain.

**Pricing unified.** `computeTotals` now takes a `VendorFees` shape rather than a
restaurant, so one path serves both catalogues and the free-delivery rule exists
once. It also returns `savings`, which the cart checklist needs.

**Stock is enforced server-side, twice**: on add (against what is *already* in the
basket, which is the case a naive check misses) and again on quantity change.

**Reorder** handles product lines, and re-adds what the shelf can cover rather than
failing the whole line — four of the six is more use than none.

**Currency is now `inr`.** It was `usd`.

**API.** `/stores`, `/products`, `/product-categories`, `POST /basket/products`.
Public reads, admin writes, matching the restaurant routes exactly. Product list
supports search, category (including a parent rolling up its children), brand,
in-stock, pagination, and five sorts — `discount` runs through an aggregate because
the saving is derived, not stored.

**Seed.** `npm run seed:stores` — six Hindaun stores (Sharma Kirana, Gupta Dairy,
Jain Medical, Sabzi Mandi, Verma Electronics, Agarwal General), twelve categories,
~45 SKUs with real MRPs in paise. Idempotent. **Images are deliberately empty**:
seeding hotlinked product photography would put someone else's copyrighted shots in
the database, and the product card already falls back to its muted tile.

**Mobile client.** Types, query functions, `use-stores.ts` hooks and
`useAddBasketProduct` are wired. The screens that consume them are Phase 4.

### Carried forward

- **Admin CRUD for stores and products does not exist yet.** The endpoints are
  live, so the catalogue is manageable by API but not by UI. Moved to Phase 5.
- Delivery fee is still per-vendor. That is correct while a basket has one vendor;
  revisit only if multi-vendor is ever built.
- Nothing decrements `stock` when an order is placed. That belongs with payment
  confirmation in Phase 3, since reserving stock against an unpaid order would
  leak inventory on every abandoned checkout.

## Phase 3 — Payments ✅ complete

Razorpay for UPI, cards, netbanking and wallets; cash on delivery as a separate
settlement path; Stripe retained behind the same seam for international cards.

### Built against the REST API, not the SDK

`razorpay` npm is **not** a dependency. The surface used is three endpoints that
do not change shape, and both signature schemes are plain HMAC-SHA256 that
`node:crypto` already does. Adding a package to call `createHmac` would put a
supply-chain surface on the payments path for nothing. The repo's payments skill
says never to fabricate package versions — this avoids the question.

API details were verified against Razorpay's current docs rather than recalled.

### The two signatures, which are not the same thing

Mixing these is the most common Razorpay bug, so both live in
`razorpay.config.ts` with the distinction written down:

| | Key | Message | Header |
| --- | --- | --- | --- |
| Checkout callback | API **key secret** | `order_id\|payment_id` | — |
| Webhook | **webhook secret** | the **raw body** | `x-razorpay-signature` |

Both compare in constant time. The webhook route is mounted with
`express.raw()` before any JSON parser — re-stringifying parsed JSON reorders
keys and every verification then fails.

### A signature is not proof of payment

The checkout callback is verified **and then the payment status is re-read from
Razorpay** before anything is released. A valid signature only proves the
callback is authentic; a client could replay one from an authorised-but-uncaptured
attempt. Only `captured` counts as paid — `authorized` is money held, not taken,
and is treated as pending.

### Cash on delivery

Not a gateway path. No provider is contacted, the order is confirmed outright,
and `codAmountDue` is owed at the door. It is a credit decision, so two
admin-controlled limits in platform settings:

- `codMaxOrderValue` (default ₹2,000) — caps the float a rider carries
- `codMaxOpenOrders` (default 2) — what a serial no-show runs into

Settlement happens in the driver's delivery completion, which already proves
presence via the delivery code, so there is no separate confirmation step.

### Stock now moves

The Phase 2 carry-forward is closed. `commitStock` runs **on payment
confirmation**, never at checkout-open — reserving against an unpaid order leaks
inventory on every abandoned sheet, and these shops have single-digit counts. The
decrement is guarded by `stock: { $gte: quantity }` so two orders racing for the
last pack cannot both win. A line that loses is logged, not thrown: the customer
has already paid, so the order stands and the shop resolves the shortfall.

`sanitizeFilter` is on globally, so every server-authored operator is wrapped in
`mongoose.trusted()` or Mongoose casts it to a literal and matches nothing.

### Other changes

- `StripeEvent` → `PaymentEvent`, keyed on **(provider, eventId)**. Razorpay sends
  no reliable delivery id, so its dedupe key is `event:payment_id` — which is the
  real invariant anyway.
- `CheckoutPayload` is now `{ order, checkout }`; `checkout` is null for COD so the
  client goes straight to tracking.
- `POST /orders/:id/verify-payment` added.
- Order carries `paymentMethod`, `paymentProvider`, `providerOrderId`,
  `codAmountDue`, `codCollectedAt`. `vendorKind`-style defaults again mean **no
  migration** for existing orders.

### Carried forward

- **`react-native-razorpay` is not installed.** `mobile/src/features/orders/payment-sheet.ts`
  is the seam: COD and Stripe work today, Razorpay returns a clear message and
  the exact implementation sits in a comment. It is a native module, so it needs
  `npx expo install react-native-razorpay` and a prebuild — not something to add
  silently to your build.
- No refund path yet. Razorpay refunds are a fourth endpoint and an admin screen.
- Checkout UI still has no payment-method selector; that is Phase 4.

## Phase 4 — Customer screens ✅ complete

### A bug this phase found and fixed

Phases 2–3 left **every store basket rendering as empty.** Both `basket.tsx` and
`checkout.tsx` guarded on `data.restaurant` being non-null, and that field is null
for a store basket by design — `vendor` is the one populated for both. The cart
header dereferenced `restaurant.imageUrl` below the guard too, so a grocery basket
would have crashed had it got past it.

Both screens now read `vendor`, and `BasketBar` matches on the vendor id of either
kind rather than `restaurantId`.

### Shipped in 4a

**Shared primitives** — built first because every remaining screen composes from them:

- `ui/skeleton.tsx` — one pulse timing for the whole app. Opacity only, no sweeping
  highlight: a sweep draws the eye to the animation, this draws it to the shape.
  Holds mid-opacity under Reduce Motion.
- `ui/empty-state.tsx` — every instance answers *what happened* and *what now*. The
  action is the point; without one it is a dead end.
- `ui/error-state.tsx` — **deliberately does not accept an error object.** Passing one
  invites `error.message` into the UI, which is how a customer reads a Mongoose cast
  error. Caller logs the real thing; customer gets a sentence and a button. Styled
  informational, not destructive — a failed fetch is usually a tunnel.
- `ui/section-header.tsx`, `product-skeletons.tsx` (grid, rail, category strip, store list).

Each skeleton mirrors its real layout exactly — same tile aspect, same 36px two-line
name box — so nothing visibly rearranges when data lands.

**Checkout** — payment method picker (UPI first, because that is what Hindaun uses),
savings line, COD-aware CTA. Cash does not say "Pay".

**COD availability moved server-side into the basket payload.** The picker greys the
option out *with the reason* rather than accepting it and refusing on submit. One
shared `codAvailability()` in `payment.service.ts` now serves both the picker and the
order-creation guard, so they cannot drift.

**Store detail** (`/store/[slug]`) and **product detail** (`/product/[id]`) — the first
screens to actually use `ProductCard`. Store page states fees up front, per the
checkout checklist's rule about never surprising someone with a cost at the end.
Category chips are built from what is on that shelf, so a filter never returns nothing.

### Shipped in 4b

**Search extended across every catalogue.** `searchCatalogue` now returns four
groups — products, shops, restaurants, dishes — all queried **in parallel**.
Products match on name, brand and tags but deliberately **not description**: on a
packaged-goods catalogue that turns "milk" into every blurb mentioning milk, which
buries the actual milk. In-stock sorts first; a sold-out result is still worth
showing, never above something buyable.

**Search screen.** Before anything is typed it is a browsing surface, not a blank
page: recent searches then popular ones. That is the state the screen is in most
often, so it gets the same care as the results. Filter chips carry live counts and
hide themselves when a group is empty. All four states present: loading skeleton,
error with retry, no-results naming the term, and the pre-search state.

**Recent searches are stored on the device, not the server.** A grocery search
history is the most revealing thing this app holds — someone searching for a
pregnancy test or diabetes strips has not asked us to keep that against their
account. SecureStore (already a dependency), and "Clear" means gone.

**Home, rebuilt** around the product catalogue: location, greeting, search,
categories, banners, deals, popular, nearby shops, then restaurants. Food sits
below groceries — this is a shop that also sells cooked food, not the reverse.
Every shelf loads independently, so one slow query cannot hold the page blank.

The home search field is now a **button, not a `TextInput`**. It always handed off
to the search screen on first keystroke, so a real field only invited typing that
got thrown away mid-push.

**Category landing** (`/category/[slug]`) with five sorts, sub-category chips drawn
from the tree, and a live result count. `slug=all` is a real route rather than a
special case, which is how "See all" from a rail lands somewhere sensible.

**Tab bar.** Five tabs, Basket added. A quick-commerce basket is checked far more
often than a food-delivery one, and the floating cart bar only appears on vendor
pages — without a tab the basket was unreachable from Orders or Profile. Height
cut from 64pt to 56pt: the bar is chrome, and every point it takes is a point of
shelf. Selection springs 2pt of lift and a 1.08 scale; colour and the
filled/outline pair do the real work of saying which tab is active.

`basket.tsx` moved into `(customer)/`. The URL is unchanged — a route group in
parentheses does not appear in the path — and its back arrow now renders only when
the screen was actually pushed, since an arrow that pops to whatever was underneath
would be lying about where it goes.

### Catalogue widened to every department

The brief changed: OnlineMall sells **everything** — medicine, cosmetics, clothes,
baby care, stationery, pet supplies, not just groceries. That broke the product
model in exactly one place, and raised one legal question.

**Variants.** A t-shirt in four sizes was four separate rows, so one shirt filled
a grid with four cards. Fixed with `variantGroupId` / `variantLabel` /
`variantType` / `isDefaultVariant`: a row is always ONE sellable SKU, siblings are
linked, and listings collapse a group to its default. This is how retail actually
works — stock, price and barcode belong to the variant, not the garment — and
crucially it needs **no change to the basket or the order**, because a line
already points at one product.

Listings attach a `variantCount` via one grouped query per page, not per card, so
a card can read "4 sizes" instead of a pack size that means nothing for a shirt.
Product detail returns siblings in the same request and offers them as a selector;
sold-out sizes stay visible and struck through, because a missing M reads as "we
never had it" rather than "it went".

**Prescription medicine.** `requiresPrescription` is enforced in
`basket.service.ts`, not merely displayed. Dispensing Schedule H drugs in India
requires a valid prescription and a registered pharmacist, and this app has
neither an upload flow nor a verification step — so the add is refused outright
rather than taken and worked out later. A flag the client is trusted to honour is
one forgotten `if` away from dispensing antibiotics to anyone who asks. The card
shows "Prescription needed" and a View button instead of Add; the detail screen
explains and points at the counter.

**Explore** (`/explore`) is the screen this change needed. Home serves people who
know what they came for; Explore serves people who do not, leading with the SHAPE
of the catalogue as a department mosaic rather than another wall of cards. A
customer who only sees Home's grocery rails would never learn the app sells
lipstick and jeans.

Search moved out of the tab bar (`href: null`) to make room — six tabs truncate
their labels at 360px, and Search is the one with other doors into it: the field
on Home, the field on Explore, and the category header.

**Seed** now covers all of it: a seventh store (Hindaun Fashion & Beauty), ~45 new
SKUs, a four-size shirt and a three-shade lipstick as real variant groups, and
both OTC and Schedule H medicine so the refusal path is testable.

### Shipped in 4c

**Profile, regrouped.** It was three stacked cards that all looked the same —
the brief's loudest complaint, and this screen was its clearest example. Now four
labelled groups (Orders & delivery, Preferences, Support, Account) plus an
Appearance control. A heading costs 20pt and says what the rows below have in
common, which a shared border never does. Identity sits edge-to-edge rather than
boxed, because it is not a list row.

Dead rows are gone. "Favourites" and "Payment methods" used to raise a
*"arrives with the next milestone"* toast; payment is now real and answers
honestly, and Favourites was removed rather than left as a button that apologises.

An order in flight is promoted above the lists — it is the single most useful
thing this screen can offer. **Log out is now confirmed**: on a phone the session
token is all that stands between the customer and a password they may not
remember.

**Push opt-in.** `PushPrimer` asks in our words before the OS asks in its own.
iOS allows exactly one system prompt; dismissed once, the only route back is
Settings, which almost nobody takes. So the primer appears **after a first order**
— when "we will tell you when it arrives" is a concrete offer rather than an
abstract permission request — and never at launch. "Not now" is a real answer,
remembered, and nothing asks twice.

`expo-notifications` is not installed (native module, needs a prebuild), so
`features/settings/notifications.ts` is the seam, same pattern as haptics. The
decision is stored either way, because asking once is the part that actually
matters.

**Order tracking** gained the two things Phase 3 created and this screen had no
copy for:

- **Cash due at the door.** A COD order owes money on arrival, and burying that
  would be the checkout checklist's "surprise at the final step", one step later.
  Shown on the confirmation screen too, since that is the one people close the
  app on.
- **Ended states.** `cancelled` and `payment_failed` previously fell through to a
  live ETA counting down and a map tracking a rider who was never dispatched.
  Both now get their own screen stating plainly that no money has moved.

**Welcome screen.** The hero was a photograph of a plated dish, which sells a
restaurant app. Replaced with the brand gradient, the wordmark, and the
department list as the first thing anyone reads — a customer who thinks this is a
food app will never look for a phone charger.

### Deferred

**Promo codes**, at your call. No model, no validation, no redemption tracking.
The edge cases are the work, not the UI: per-user limits, expiry, minimum spend,
first-order-only, and whether they stack with the free-delivery threshold.

### Real-world obligations this code does not satisfy

Flagged because they are not engineering problems and cannot be solved in the
repo: selling medicine online in India needs a licensed pharmacy and a registered
pharmacist attached to the fulfilling store; cosmetics and packaged food carry
labelling and expiry-date obligations; and the Legal Metrology rules on declaring
MRP, net quantity and seller identity apply to every listing here.

## Phase 5 — Role interfaces ✅ complete

Store, delivery and admin surfaces share the tokens but not the density:
customer = visual and fast, store = operational, delivery = task-oriented and
one-handed, admin = tabular and analytical.

### Two bugs this phase found

**The admin was still printing dollars.** `formatMoney` in `admin/src/lib/format.ts`
emitted `$` across 47 call sites — Phase 1 converted the app to INR and missed the
backoffice entirely. Now rupees with the same Indian digit grouping as mobile, and
deliberately **always two decimals**: unlike the storefront, a backoffice column is
read by someone reconciling figures, and ₹45 above ₹45.50 does not line up.

**The rider was never told to collect cash.** Phase 3 added COD, and the `Delivery`
payload already carried `paymentMethod` and `codAmountDue` — the driver UI simply
never read them. A rider who is not told has to guess, and guessing wrong costs
them the money. The delivery screen now states the amount prominently, the confirm
sheet repeats it at the moment the money changes hands, and prepaid orders say
**"already paid online — collect nothing"**, because stating that is as important
as stating an amount.

### Admin catalogue (the Phase 2 carry-forward, closed)

Stores and products were manageable by API only. Now:

- `/stores` — list with ETA, fees, minimum and rating on the row, because a row is
  a decision about whether a shop is trading and on what terms. **Listed** and
  **Open** are shown as separate badges: conflating them hides the common case of
  a live shop that is simply shut for the night.
- `/stores/:slug` — store detail with its shelf. The product table requests
  `includeVariants`, so every SKU is listed. The app collapses a variant group to
  one card because a shopper wants one shirt; an admin counting stock wants all
  four sizes. Low stock is coloured rather than left to be spotted in a column of
  similar digits.
- Store and product dialogs. **Money is entered in rupees and stored in paise** —
  asking an admin to type 2500 for a ₹25 delivery fee is how a shop ends up
  charging ₹2,500 for one. An MRP below the selling price is caught in the form as
  well as clamped in the model, so the admin sees why their discount will not
  appear rather than having it silently corrected after saving.
- The prescription switch is in the product form with its consequence spelled out:
  the app refuses to basket these.

### Admin settings

The COD policy shipped in Phase 3 had no UI. Now a fourth card: the master switch,
the cash ceiling and the open-orders limit, with the ceiling and limit validated
only when cash is actually on — a stale number behind a disabled switch is not
worth blocking a save over.

### Also

`apiMessage(error, fallback)` added to `admin/src/lib/axios-client.ts`. `catch`
gives `unknown`, and every call site writing its own narrowing is repetitive and
easy to get subtly wrong; the fallback is always caller-supplied so a raw
exception can never reach the screen.

### Shipped in 5b — one app, three roles

Confirmed decision: **admin is a separate web app**, not published to the Play
Store, talking to the same API. That is already how `admin/` is built, so nothing
changed there. **Customer, store owner and delivery partner all share the one
mobile app** and pick their role at sign-in.

#### The picker chooses a door, not a permission

`loginSchema` gained an optional `intendedRole`. The server compares it with the
role stored on the account and **refuses a mismatch — it never assigns one**. A
picker that could grant a role would be an authorisation hole with a dropdown in
front of it.

Two details that matter:

- The role is checked **after** the password, so a wrong guess at the role cannot
  be used to probe which accounts exist or what they are.
- `admin` is absent from the picker *and* rejected at login from the app, with a
  message pointing at the backoffice. The admin role shares the user collection
  but not the front door.

`landingRouteFor` now sends `store_owner` to `/store-dashboard`, alongside
`driver` → `/driver-home`. The role on the account decides; the picker only
states an intention.

#### The store-owner role

`USER_ROLES` gained `store_owner`, and `User` gained `storeId`. **Every
store-owner query is scoped to the shop on the account and nothing takes a
storeId from the client** — a shopkeeper who could pass an id would be reading
the neighbouring kirana's order book. Another shop's order returns *not found*
rather than *forbidden*, which would confirm it exists.

Three deliberate limits on what a shop can do:

1. **Only two status transitions**: `confirmed → preparing → ready`. Dispatch and
   delivery belong to the rider, payment to the gateway. A shop that could mark an
   order delivered could close out an order that never left the counter.
2. **Stock and listing, not price.** Price is a commercial agreement, and one that
   can move from a phone can change a basket's total between a customer adding an
   item and paying for it. Price edits stay in the backoffice.
3. **Open/closed is the shop's call; being listed at all is the admin's.**

#### The shopkeeper's screens

Three tabs — Counter, Orders, Shelf. Same tokens as the storefront, different
density: no imagery, no rails, tabular figures, because this screen is read
rather than browsed. A shop owner opens it to answer three questions, and padding
it out with discovery surfaces borrowed from the customer app would bury them.

Stock is edited with +/- rather than a keyboard: someone counting packs one-handed
is not going to type, and a stepper cannot produce the typo that lists 500 bags of
atta. The counter polls every 20 seconds — fast enough that a new order appears
before a customer rings to ask, slow enough not to put a kirana's phone on a
5-second loop all day.

Cash orders are flagged to the shop too, so an order is packed knowing money is
owed at the door.

#### Also fixed

A stale `<Stack.Screen name="basket" presentation="modal">` was left at the root
when Phase 4b moved the basket into the customer tabs. Removed.

### Shipped in 5c — onboarding

The blocker was real: the `store_owner` role existed but attaching a shopkeeper to
a shop needed a direct database write, which is not an onboarding process — it is
a reason not to onboard anyone.

**Store-owner accounts** (`/store-owners`). Create, edit, move between shops,
deactivate. Three decisions worth recording:

- **One shop, one owner.** Two accounts on the same shop means two people
  toggling the counter open and closed against each other with no record of who
  did what. Shared staff logins need a proper staff model, not a second owner.
- **Deactivate, never delete.** Their past orders reference the account, and
  removing the row would orphan an audit trail a shop may need months later.
  `isActive: false` already blocks sign-in.
- **The temporary password is shown in plain text.** You have to read it out to
  them, so hiding it behind dots would just mean copying it somewhere worse.
  Email cannot be changed on an edit: that is an identity change, not a fix to a
  phone number.

The page leads with **which shops have no owner**, because that is the reason an
admin opens it — nobody can accept those shops' orders from the app.

**Product categories** (`/product-categories`). Shown as a tree, not a table: the
parent/child relationship *is* what is being edited, and a "parent" column makes
you read the structure instead of seeing it. The API already refused to delete a
category still holding products or children, and its message names the count,
which is the useful part.

**The admin order list now distinguishes shop orders from restaurant orders** —
the column is "Vendor" rather than "Restaurant", with the kind and a cash flag
underneath. A restaurant-only heading above a kirana's name was simply wrong.

### Analytics and refunds

**A correction to this document.** It previously said analytics counted
restaurant revenue only. **That was wrong** — `analytics.service.ts` has no
vendor filter at all and has always aggregated every paid order, groceries
included. The real gap was being unable to see WHICH half was which.

So the fix is a split, not a widening: revenue grouped by `vendorKind`, and a
second grouping by `paymentMethod`. Both default historic rows to
`restaurant` / `card`, so orders written before stores and UPI existed land in
the right bucket with no backfill. The COD row doubles as an operational figure —
it is the cash riders are carrying around Hindaun.

**Refunds.** `POST /admin/orders/:orderId/refund`, full or partial, with three
things worth recording:

- **Two genuinely different cases.** A prepaid order reverses through the
  gateway; a cash order has nothing to reverse, so the refund is a hand-back the
  shop settles and the record exists so it is not forgotten. Telling a cash
  customer money is "on its way" when nobody has sent any is the failure this
  avoids.
- **Idempotent on the order id.** A double-click or a network retry cannot pay
  the customer twice — Razorpay returns the original refund for a repeated key.
- **A full refund cancels the order and puts its stock back.** A cancelled
  grocery order that leaves its items decremented silently shrinks a shelf every
  time, and a kirana with single-digit counts notices within a day. Partial
  refunds do NOT restore stock, because a partial refund does not say which line
  it was for.

### Still open — and what only you can do

Everything left needs your machine, a device, or a decision:

1. **Install three native modules.** `expo-haptics`, `expo-notifications`,
   `react-native-razorpay`. All three sit behind working seams with the real
   implementation in a comment. Until Razorpay is in, online payment does not work
   on a device; COD does.
2. **Run `eas init`** — the project id was blanked rather than guessed, because it
   pointed at the original author's account.
3. **Seed and pilot**: `npm run seed:stores`, create one real shop and one owner,
   then walk an order end to end. That will surface what review cannot.
4. **App icon and splash artwork** still ship the old teal mark.
5. **The licence.** `TECHWITHEMMA-LICENSE.md` requires a paid licence for
   commercial use.
6. **Pharmacy licensing** before any prescription medicine goes live, plus the
   Legal Metrology declarations on every listing.
7. **Promo codes**, if you want them.

## checklist.design audit

Applied manually from the published checklists — no external skill, per instruction.

### Passing after Phase 1

| Checklist | Evidence |
| --- | --- |
| Design system › Colour | Semantic roles, both themes, no raw hex in components. |
| Design system › Tokens | Single source in `global.css`; superset verified. |
| Design system › Typography | Ten roles with price above body; tabular figures. |
| Design system › Spacing/Grid | Named gutter/section/rail on a 4pt scale. |
| Design system › Button | Variants, all states, loading, disabled, press feedback. |
| Design system › Badge | Offer, ETA, out-of-stock — each with one owner colour. |
| Design system › Icon | One family, consistent stroke, three sizes. |
| Design system › Accessibility | 44pt via hitSlop, adjustable stepper role, Reduce Motion. |
| Flows › Adding to cart | Add→stepper is one control; grid cannot reflow; stock capped. |
| Mobile › Splash screen | Brand green, matched dark value. |

### Known failing, scheduled

| Checklist | Gap | Phase |
| --- | --- | --- |
| Mobile › Cart | No promo code. | 4c |
| Mobile › Checkout | No promo code. | 4c |
| Mobile › Billing | Selector shipped. Razorpay SDK still not installed. | — |
| Mobile › Search | Shipped: recent, popular, filters, counts, all states. | ✅ |
| Mobile › Onboarding | Location-only; no value framing. | 4c |
| Mobile › Push opt-in | No notification permission flow at all. | 4c |
| Web app › Empty state | Applied across catalogue screens; admin lists pending. | 5 |
| Web app › Data table | Admin tables lack density and column control. | 5 |
| Design system › Skeleton | Shipped: shared primitive + catalogue skeletons. | ✅ |
| Design system › Toast | Sonner mounted but variants are not standardised. | 4c |
| Flows › Entering promo code | Not implemented anywhere. | 4 |
| Flows › Showing input error | Inconsistent between auth and address forms. | 4 |
| Website › * | No public marketing surface exists. | Out of scope |

### Not applicable

2FA, API keys, Kanban, Gantt, version history, audit log, paywall, referral,
affiliate, careers, press, waitlist, blog, camera, chat, in-app browser.

## Licence

This repository is under `TECHWITHEMMA-LICENSE.md`: free for personal use, **paid
licence required for commercial use**. OnlineMall as described is a commercial
product. Resolve before launch.
