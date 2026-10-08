# Mobile Design — Chowly
Status: Draft
Last updated: 2026-09-03

## Product

Food delivery app (Expo, iOS + Android) serving two roles from one binary: **customers** order from nearby restaurants to a saved address and follow the order to the door; **drivers** go online, claim a ready order from a queue, and advance it to delivered. Activation moment: the first order is placed and the tracking screen shows a live status.

Locked by the user: teal system below, exact hex values · Home has a teal delivery header with address + notification bell, header ending **before** the search area · search field sits fully inside a white content sheet with **28px top corners** · circular categories, promotional food banners, "Popular near you", "Top picks for you", image-led restaurant cards · bottom navigation **Home, Search, Orders, Profile** with Favourites reached from Profile · tapping the address opens a bottom-sheet modal · "Continue with Google" shows an alert only.

Excluded from v1: ratings/reviews written by users, promo codes, scheduled orders, multi-restaurant baskets, chat, tips, live courier map.

## Direction

Appetite-first and calm: photography carries the energy, the interface stays quiet. One teal accent family for interaction, warm accents reserved strictly for merchandising (ratings, offers).

**Colour (locked).** brand teal `#00BFA5` · Home header gradient `#00C9B4 → #00B39F` (vertical) · pressed teal `#009E89` · accessible teal button `#007F72` · teal tint `#E6FAF7` · canvas `#F7FAFA` · surface `#FFFFFF` · subtle surface `#F3F6F5` · border `#E3ECEA` · primary text `#102A2A` · secondary text `#667575` · muted text `#98A5A5` · rating orange `#FF8A00` · offer amber `#FFB020` · offer coral `#FF6B4A` · success `#16A34A` · warning `#F59E0B` · error `#EF4444`.

**Colour rules.** Filled buttons and any teal carrying white text use `#007F72` (white passes AA); `#00BFA5` and the gradient are surface/decoration only. Header ink is white: "Deliver to" in white at 70% opacity, the address in sharp bold pure white, bell icon solid white. `#E6FAF7` backs selected chips, quantity steppers, and the active tab pill. Rating orange appears only as the star + score; amber/coral only inside promotional banners and offer badges — never on navigation or primary actions. Light theme only in v1; dark theme deferred with the same roles.

**Typography.** Inter throughout (Regular/Medium/SemiBold/Bold). Display 28/34 Bold (screen titles, order total) · Title 22/28 Bold (section headers on sheets) · Section 17/22 SemiBold ("Popular near you") · Body 15/22 Regular · Label 13/18 Medium (metadata, "Deliver to") · Caption 11/14 Medium (badges). Prices, ETAs, distances and totals use tabular figures; prices always show two decimals.

**Space and shape.** 4-point rhythm; screen gutter 20; section gap 28; in-section gap 12; control height 52; inputs radius **12**, cards radius **16**, content sheet top corners **28**, bottom-sheet top corners 28, chips/pills fully rounded, category circles 64. Borders are 1px `#E3ECEA`. Shadows restrained: only the sticky basket bar, bottom sheets, and the floating tab bar get `0 2px 12px rgba(16,42,42,0.08)`; cards rely on borders.

**Icons and imagery.** Rounded outline icons, 24px, ~1.75 stroke, `#102A2A` (active teal `#007F72`); no emoji as interface icons. Restaurant cards use 16:9 photography, dish rows 1:1 at 72px, category circles a centred food photo, banners 2:1. Every image gets a `#F3F6F5` shimmer while loading and a teal-tint fallback tile with the restaurant initial on failure.

**Motion.** Content-level, never whole-screen dissolves. Home sheet sections stagger in 12px/160ms on first paint; category and card rows animate opacity only when scrolled into view. The address sheet springs up (damping 0.8, 280ms) with a dimmed scrim. Add-to-basket bumps the basket-bar count (scale 1→1.12→1) with a selection haptic. Tracking advances animate the active timeline node with a slow 2s pulse. Reduce Motion presents final states immediately and keeps the haptic.

**Accessibility.** 4.5:1 minimum for text everywhere except the Home teal header, where white ink is a deliberate brand choice measuring ~2:1 against the locked gradient — an accepted deviation, with an unapplied mitigation available (a `rgba(4,48,43,0.18)` scrim behind the header text block, which keeps the teal read and lifts contrast). Elsewhere: 44pt minimum targets, Dynamic Type to 200% with cards growing and titles truncating at two lines, VoiceOver labels on the bell, heart, and stepper, and a keyboard-avoiding checkout. Location denial never blocks the flow.

## Screen inventory

**Onboarding and auth**

1. **Splash** — Chowly mark centred on the teal gradient; holds until fonts and the stored session resolve, then routes to Welcome, Home, or the driver queue.
2. **Welcome** — full-bleed food hero, wordmark, promise "Your neighbourhood, delivered.", primary "Continue with email", secondary "Continue with Google" (shows an alert: not available yet), footer "Already have an account? Log in".
3. **Sign up** — name, email, phone, password (strength hint) on canvas; 12px inputs; primary "Create account"; inline field errors in `#EF4444`.
4. **Log in** — email + password, "Forgot password?" (disabled note in v1), primary "Log in".
5. **Location permission** — plain-language benefit ("So we can show restaurants that deliver to you"), illustrated map card, primary "Use my location", secondary "Enter address manually". Denial routes to the manual form, never a dead end.
6. **Address capture** — GPS-prefilled editable fields (label chips Home/Work/Other, street, city, postcode, delivery instructions), map thumbnail with a teal pin, primary "Save address". *Answer changes:* the saved default becomes the Home header address and the checkout default.

**Discovery**

7. **Home Discovery** — expanded below.
8. **Address switcher (bottom sheet)** — title "Delivery address", radio list of saved addresses with label + line, selected row on `#E6FAF7` with a teal check, "Add new address" row, grab handle, scrim dismiss. *Answer changes:* header address, restaurant list, and checkout address.
9. **Search** — search field pinned under a compact teal strip; idle shows "Recent searches" chips and "Popular cuisines"; typing returns grouped Restaurants / Dishes results; empty state uses the no-results illustration with "Try a different cuisine".
10. **Category results** — category name as title, restaurant list, filter row (Delivery fee, Rating, Fastest) as outline chips that fill teal-tint when active.
11. **Restaurant detail** — 16:9 hero, name, rating/reviews, ETA, delivery fee, minimum order, open/closed pill, sticky menu-section tabs, dish rows with photo, name, description, price; sticky basket bar appears once an item is added.
12. **Dish detail (bottom sheet)** — large photo, name, description, quantity stepper, notes field, primary "Add to basket · $9.50". Switching restaurants warns "Start a new basket?" with Cancel / Start new.

**Ordering**

13. **Basket** — restaurant name, editable line items with steppers, "Add more items", fee breakdown (subtotal, delivery, service), total in Display size, primary "Go to checkout". Empty state: illustration + "Your basket is empty" + "Browse restaurants".
14. **Checkout** — delivery address card with Change, ETA, payment method row (card), full fee breakdown, primary "Pay $14.48". Stripe PaymentSheet is native system UI and is not restyled.
15. **Order confirmed** — success tick on teal tint, order number, ETA, primary "Track order", secondary "Back to home".
16. **Order tracking** — status timeline (Confirmed → Preparing → Ready → On the way → Delivered) with the active node pulsing, restaurant + driver card (name, vehicle, masked call button) once claimed, address recap, order summary, help link. States: awaiting payment confirmation, cancelled, delivered.
17. **Orders tab** — Active section then Past, each row showing restaurant thumbnail, item count, total, status pill; empty state offers "Start your first order".
18. **Favourites** — opened from Profile, not a tab: saved restaurant cards with filled teal hearts, swipe-to-remove; empty state explains how to save one.
19. **Profile** — avatar, name, email, rows for Favourites (with count), Addresses, Payment methods, Notifications, Help, About, and a destructive "Log out".
20. **Manage addresses** — list with default badge, edit/delete, "Add address".
21. **Notifications** — bell destination; order-status entries with unread teal dot; empty state "No notifications yet".

**Driver**

22. **Driver home (queue)** — teal header with online/offline switch and today's totals (deliveries, earnings), white sheet listing ready orders: restaurant, pickup distance, drop-off area, payout, "Claim" button.
23. **Delivery detail** — pickup and drop-off cards, item count, payout breakdown, primary "Claim delivery". Claim-race state: inline "This order was just claimed" and the list refreshes.
24. **Active delivery** — big current-step card, addresses with call/navigate actions, and a slide-to-confirm control advancing Picked up → Delivered.
25. **Delivery history** — day-grouped completed deliveries with payout totals.

### 7. Home Discovery (expanded)

Reading order top to bottom:

- **Teal header** (gradient `#00C9B4 → #00B39F`, top-safe-area padded, ~132px): left column with "Deliver to" in 13 Medium white at 70% opacity and the address directly below it in **18/24 Bold pure white** with a white chevron — the whole block is one tap target opening screen 8; right side a 40px white bell with a coral unread dot.
- **White content sheet** begins right below, 28px top corners, `#FFFFFF`, overlapping the header by 20px so the curve reads clearly. The header stops here — nothing teal continues behind the sheet.
- **Search field** fully inside the sheet, 12px radius, `#F3F6F5` fill, 1px border, leading search icon, placeholder "Search Chowly".
- **Categories** — horizontal row of 64px circles with 13px labels: Pizza, Burgers, Jollof, Sushi, Healthy, Desserts.
- **Promotional banners** — 2:1 carousel with page dots; card one uses an offer-amber wash, "20% off your first order", "Min. spend $12 · Ends Sunday"; card two coral, "Free delivery on Green Bowl".
- **Popular near you** — horizontal image-led cards (272px wide): photo, heart overlay, name, rating orange star "4.7 (320+)", "25–35 min · $1.99 delivery".
- **Top picks for you** — vertical full-width cards, same anatomy plus a cuisine line and an "Offer" badge where relevant.
- **Bottom navigation** — four items (Home, Search, Orders, Profile), outline icons, active item teal `#007F72` with label, surface background, hairline top border.

States: skeleton shimmer for categories/cards on load; closed restaurants render at 60% opacity with a "Closed" pill; a no-coverage state replaces the lists with "Nothing delivers here yet" and a Change address button.

## Components and states

Shared: primary button (52px, `#007F72`, white 15/SemiBold, pressed `#009E89`, disabled `#E3ECEA` with muted text), secondary outline button, input (12px, `#F3F6F5`, focus ring teal, error border `#EF4444` with 13px message), chip, restaurant card, dish row, quantity stepper (teal-tint pill), status pill, section header with optional "See all", sticky basket bar (teal, item count + total + "View basket"), bottom sheet (28px corners, grab handle, scrim `rgba(16,42,42,0.45)`), toast (surface + hairline, success/error leading icon), skeleton shimmer, and empty state (illustration + title + one action). Every list supports loading, populated, empty, and error-with-retry.

## Assets

None exist — `mobile/assets` holds Expo template art only. Style lock for all illustration: soft flat vector, teal-family palette with warm food accents, rounded shapes, no outlines, no text.

- `chowly-wordmark.svg` + `chowly-mark.svg` — wordmark and standalone mark; mark replaces `splash-icon.png` and the app icon.
- `welcome-hero.jpg` (3:4, 1200×1600) — *"Warm overhead photograph of a shared table of colourful takeaway dishes on a light surface, natural side light, shallow depth of field, generous empty space in the upper third for a logo and headline. No text, logo, watermark, or UI controls."*
- `empty-basket.png`, `empty-orders.png`, `empty-favourites.png`, `search-no-results.png` (1:1, 800×800, transparent) — *"Soft flat vector illustration, teal `#00BFA5` and warm coral accents on transparent background, rounded shapes, no outlines: an empty takeaway bag standing upright. No text, logo, watermark, or UI controls."* (swap the subject per file: empty receipt roll, outline heart with a small plate, magnifier over an empty plate).
- `location-permission.png` (4:3) — stylised map card with a teal pin.
- Category, banner, restaurant and dish imagery come from Cloudinary in production; use licensed food photography for board and demo only.

Nothing here has been generated yet.

## Representative data

Restaurants: Mama Chow's Kitchen (4.7, 320+ ratings, 25–35 min, $1.99), Bosco Pizza Co. (4.5, 20–30 min, free delivery), Green Bowl (4.8, 30–40 min, $2.49), Suya Republic (4.6), The Noodle Bar (4.4). Dishes: Jollof Rice & Grilled Chicken $9.50, Double Pepperoni $12.00, Chicken Suya Wrap $7.25. Basket example: subtotal $11.99 + delivery $1.99 + service $0.50 = **$14.48**. Order `#CH-2481`, ETA 18:40, driver "Tunde A. · Blue Honda". Offers: 20% off first order (min $12), free delivery on Green Bowl. Driver day: 6 deliveries, $42.30.

**Must be replaced with real data before release:** all restaurant/dish names, prices and photography (Cloudinary + API); ETAs and delivery/service fees (per-restaurant fee + config percentage); driver payouts; notification copy; and prices, which are now shown in **USD** (R1 resolved).

Ratings and promotional banners are **admin-entered data**, not user-generated reviews or an offer engine: `rating`/`ratingCount` live on the Restaurant record and banners come from an admin-managed Banner collection. Scores shown here are representative until admin enters real ones, and the UI must never present them as customer reviews.

## Board prompt and review

Status: ready to generate; no board produced yet.

```text
Create a high-resolution mobile UI board for Chowly, a food delivery app for city customers
ordering from nearby restaurants, plus a driver mode in the same app.

PRODUCT AND SCOPE
iOS/Android portrait app, 25 screens across four flows: onboarding and auth, discovery,
ordering and tracking, and account plus driver. The activation moment is a placed order
followed by a live tracking screen.

VISUAL DIRECTION
Appetite-first and calm; photography carries energy, UI stays quiet. Colours: brand teal
#00BFA5, Home header vertical gradient #00C9B4 to #00B39F, pressed teal #009E89, filled
buttons #007F72 with white labels, teal tint #E6FAF7, canvas #F7FAFA, surface #FFFFFF,
subtle surface #F3F6F5, borders #E3ECEA, primary text #102A2A, secondary #667575, muted
#98A5A5, rating orange #FF8A00, offer amber #FFB020, offer coral #FF6B4A, success #16A34A,
warning #F59E0B, error #EF4444. Teal header ink is white: label at 70% opacity, address in bold
pure white. Inter typeface: 28
Bold titles, 22 Bold sheet headers, 17 SemiBold section headers, 15 Regular body, 13 Medium
labels, tabular figures for prices. 4-point spacing, 20px gutters, 52px controls, 12px
inputs, 16px cards, 28px content-sheet and bottom-sheet top corners, 1px hairline borders,
restrained shadows only on sticky bars and sheets. Rounded outline icons at 24px, no emoji.
16:9 restaurant photography, 1:1 dish thumbnails, 64px circular category tiles, 2:1 banners.

SCREENS
1 Splash: Chowly mark on teal gradient.
2 Welcome: food hero photo, wordmark, "Your neighbourhood, delivered.", primary "Continue
  with email", secondary "Continue with Google", "Already have an account? Log in".
3 Sign up: name, email, phone, password fields, primary "Create account".
4 Log in: email, password, primary "Log in".
5 Location permission: benefit copy, map illustration, "Use my location" and "Enter address
  manually".
6 Address capture: Home/Work/Other chips, prefilled street "14 Bramley Road", city, postcode,
  delivery instructions, map thumbnail with teal pin, "Save address".
7 Home Discovery: teal gradient header with "Deliver to" in translucent white above "14 Bramley
  Road" in bold white plus a white chevron on the left, and a white notification bell with a coral
  dot on the right; the teal ends and a white content
  sheet with 28px top corners begins, containing the search field "Search Chowly", circular
  categories (Pizza, Burgers, Jollof, Sushi, Healthy, Desserts), a 2:1 promo banner "20% off
  your first order · Min. spend $12", "Popular near you" horizontal cards (Mama Chow's
  Kitchen 4.7 (320+), 25-35 min, $1.99 delivery; Bosco Pizza Co. 4.5, 20-30 min, free
  delivery), "Top picks for you" vertical cards, and a four-item bottom navigation: Home,
  Search, Orders, Profile with Home active in teal.
8 Address switcher bottom sheet over a dimmed Home: "Delivery address", saved rows Home /
  Work / Mum's place, selected row on teal tint with a check, "Add new address".
9 Search: results grouped Restaurants and Dishes for the query "jollof", recent-search chips.
10 Category results: "Pizza" title, filter chips Delivery fee / Rating / Fastest, restaurant list.
11 Restaurant detail: hero photo of Mama Chow's Kitchen, 4.7 rating, 25-35 min, $1.99 delivery,
   Open pill, menu section tabs, dish rows with photos and prices, sticky basket bar.
12 Dish detail bottom sheet: Jollof Rice & Grilled Chicken photo, description, quantity stepper
   at 2, notes field, primary "Add to basket · $19.00".
13 Basket: Mama Chow's Kitchen, two line items with steppers, subtotal $11.99, delivery $1.99,
   service $0.50, total $14.48, primary "Go to checkout".
14 Checkout: address card with Change, ETA 18:40, card payment row, fee breakdown, "Pay $14.48".
15 Order confirmed: teal-tint success tick, order #CH-2481, "Arriving by 18:40", "Track order".
16 Order tracking: timeline Confirmed, Preparing, Ready, On the way (active, pulsing), Delivered;
   driver card "Tunde A. · Blue Honda" with call button; order summary.
17 Orders tab: Active order #CH-2481 in progress, past orders with totals and status pills.
18 Favourites, opened from Profile: saved restaurant cards with filled teal hearts.
19 Profile: avatar, "Amaka Obi", email, rows for Favourites (4), Addresses, Payment methods,
   Notifications, Help, About, and Log out in red.
20 Manage addresses: Home (Default badge), Work, Mum's place, edit and delete actions.
21 Notifications: order status entries with unread teal dots.
22 Driver home: teal header with online toggle set to Online and "6 deliveries · $42.30 today";
   white sheet queue of ready orders with pickup distance, drop-off area, payout and Claim.
23 Delivery detail: pickup and drop-off cards, 3 items, payout $6.40, primary "Claim delivery".
24 Active delivery: current step card, addresses with navigate and call, slide-to-confirm
   "Slide to mark delivered".
25 Delivery history: deliveries grouped by day with payout totals.

BOARD COMPOSITION
Four numbered boards of portrait phone frames in flow order, consistent device framing, light
neutral board background, small screen-name captions outside each frame. Generate one board per
run, pasting the PRODUCT, VISUAL DIRECTION and QUALITY blocks above with only that board's screens.
Board 1 Onboarding and auth: screens 1-6, three columns by two rows.
Board 2 Discovery: screens 7-12, three columns by two rows.
Board 3 Ordering and tracking: screens 13, 14, 15, 16, 17, 21, three columns by two rows.
Board 4 Account and driver: screens 19, 18, 20, 22, 23, 24, 25, four columns by two rows.

QUALITY AND AVOID
Text must be legible and correctly spelled; prices consistent across basket, checkout and
confirmation; the same teal used for every primary action; exactly four bottom-navigation items; the Home teal header must stop
before the search field, which sits inside the white 28px-cornered sheet. Realistic food
photography, believable names and prices. No sample, demo, mock, placeholder or Lorem ipsum
labels; no copied branding from existing delivery apps; no emoji as interface icons; no
gradients outside the Home and Splash headers; no drop shadows on ordinary cards.
```

## Open decisions

- **Currency** is USD; money is stored and sent in minor units (cents) and formatted with $.
- **Home reference image** was not received — Home was designed from your written description.
