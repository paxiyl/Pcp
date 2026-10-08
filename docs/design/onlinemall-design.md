# Mobile Design — OnlineMall (Hindaun)

Status: Phase 1 locked (foundation), Phases 2–5 pending
Last updated: 2026-10-06
Supersedes: `mobile-design.md` (Chowly). That file is kept for the restaurant/dish
screens still running on it; delete it once Phase 4 lands.

## Product

A local quick-commerce marketplace for **Hindaun City, Rajasthan**. One Expo binary
serves three roles: **customers** shop groceries, daily essentials, food, household
items, personal care and electronics from nearby stores and follow the order to the
door; **delivery partners** go online, claim a ready order and advance it to
delivered; **store owners and admins** work in the Vite backoffice.

The activation moment is the first order landing in under the promised ETA.

What makes this different from the food-delivery app it grew out of: a basket can
hold products from more than one store, a product is a packaged SKU with an MRP and
a pack size rather than a cooked dish, and speed is the headline promise rather than
a secondary detail.

## Direction

**Dense, quick and trustworthy.** The screen earns its keep by showing more real
product per scroll than a food app would, without becoming noisy. Photography does
the selling; the interface stays quiet around it.

Premium here is not gradients and glass. It is: a price that is always the loudest
thing in its row, a grid that never reflows when someone taps Add, a skeleton that
matches the layout it replaces, and a green that appears only where it means
"go" — never as decoration.

### Colour

Green-led, warm neutral canvas. Defined in `mobile/src/global.css`; never repeat a
hex in a component.

| Role | Light | Dark | Used for |
| --- | --- | --- | --- |
| `primary` | `#116E3C` | `#35C172` | Filled buttons, Add controls, active tab. AA with white. |
| `primary-hover` | `#15804A` | `#4AD183` | Web/admin hover only. |
| `primary-pressed` | `#0D5A30` | `#2AA660` | Press state. |
| `primary-soft` / `secondary` | `#E8F6EC` | `#13301F` | Add pill fill, selected chips, stepper tint. |
| `brand` | `#1FA85C` | `#35C172` | Surfaces and decoration only — never behind white text. |
| `background` | `#F7F6F2` | `#10140F` | Canvas. Warm, not white. |
| `surface` / `card` | `#FFFFFF` | `#181D16` | Content sheets, rows. |
| `elevated` | `#FFFFFF` | `#1F2620` | Sheets, floating bars. |
| `muted` | `#F1F0EB` | `#1F2620` | Product image tiles, skeletons. |
| `border` | `#E6E3DA` | `#2C342C` | Hairlines. |
| `text-primary` / `foreground` | `#15201A` | `#F2F5F0` | Names, prices, headings. |
| `text-secondary` | `#5B6660` | `#A3ADA4` | Metadata, descriptions. |
| `text-muted` | `#8A938D` | `#7F8A80` | Pack size, struck MRP, timestamps. |
| `offer` | `#E04E1B` | `#FF7A4D` | Discount flags, offer badges. Nothing else. |
| `delivery` | `#6D28D9` | `#A78BFA` | ETA and speed badges. Distinct from brand on purpose. |
| `rating` | `#F08C00` | `#FFA733` | Star + score only. |
| `success` / `warning` / `error` / `info` | `#16A34A` / `#D97706` / `#DC2626` / `#2563EB` | — | Status. Each has a `-soft` wash for banners. |

**Rules.** `brand` and the header gradient are surface only; any green carrying
white text uses `primary`. `offer` never appears on navigation or a primary action.
`delivery` is reserved for the speed promise so the ETA stays findable in a dense
grid. Both themes are now design-approved, unlike the Chowly system where dark was
derived.

### Typography

Inter throughout (Regular / Medium / SemiBold / Bold). Price roles sit between
`title` and `section` so money outranks body copy everywhere.

| Role | Size/line | Weight | Used for |
| --- | --- | --- | --- |
| `hero` | 56/60 | Bold | Splash wordmark only. |
| `display` | 28/34 | Bold | Screen titles, order total. |
| `title` | 22/28 | Bold | Sheet headers, cart total. |
| `price-lg` | 20/26 | Bold | Product detail price, checkout total. |
| `section` | 17/22 | SemiBold | "Popular in Hindaun". |
| `price` | 16/20 | Bold | Product card price. |
| `body` | 15/22 | Regular | Descriptions, buttons. |
| `label` | 13/18 | Medium | Product name on a card, metadata. |
| `caption` | 11/14 | Medium | Pack size, struck MRP. |
| `micro` | 10/13 | Bold | Discount flags, ETA pills. |

Prices, ETAs, quantities and totals use `fontVariant: ["tabular-nums"]`, so a digit
changing never shifts the layout. Prices show paise only when the amount is not
whole — ₹45, not ₹45.00.

### Space and shape

4-point rhythm. Named utilities so a screen never invents its own gutter:
`p-gutter` = 20, `gap-section` = 28, `gap-rail` = 12. Control height `h-13` = 52.

Radii: chips 10, inputs 12, cards 16, product tiles 20, sheets 28, pills full.

**Shadows are rationed to three places** — the floating cart bar, bottom sheets and
the tab bar — via `shadow-float` and `shadow-sheet`. Everything else separates with
a hairline or a fill. The brief's biggest complaint about the old UI was that every
element became a white rounded rectangle with a shadow; the product card has
deliberately neither.

### Motion

`mobile/src/lib/motion.ts` is the only source of durations and springs.

- Entrances 220ms, exits 150ms, route changes 200ms, state changes 140ms.
- Springs: `snappy` (stiffness 500 / damping 32) for steppers, counts, badges;
  `standard` (420 / 30) for layout; `gentle` (350 / 28) for sheets and the cart bar.
- Press feedback starts on press-in: 0.97 for controls, 0.985 for cards. The hit box
  never scales, only the visual.
- Reduce Motion presents final states immediately and keeps the haptic.

### Haptics

`mobile/src/lib/haptics.ts` is a working no-op behind a real interface, because
`expo-haptics` is not yet a dependency and the repo's Expo skill forbids installing
feedback infrastructure unprompted. Call sites are already correct. Three events
only: item in/out of basket, order paid, delivery confirmed.

### Icons and imagery

Ionicons, outline family, 1.75 stroke. 24px in chrome, 18px in controls, 10px inside
badges. No emoji as interface icons.

Product images are 1:1 `contentFit="contain"` on a `muted` tile — packaged goods are
shot on white, so contain keeps a shampoo bottle and a rice sack the same visual
weight. Store covers are 16:9, category tiles 1:1, banners 2:1. Every image gets a
`muted` tile beneath it, which doubles as the loading state.

## Components built in Phase 1

| File | What it is |
| --- | --- |
| `lib/brand.ts` | Every user-facing name. Renaming the app is one edit. |
| `lib/format.ts` | INR money in paise, **Indian digit grouping** (₹12,34,567), ETA, discount and savings strings derived from MRP so a badge can never disagree with the price. |
| `lib/motion.ts` | Durations, springs, press scales, Reduce Motion handling. |
| `lib/haptics.ts` | The three meaningful haptics, behind one seam. |
| `ui/pressable-scale.tsx` | Press feedback driven from a shared value, hit box fixed. |
| `ui/quantity-stepper.tsx` | Add and stepper as **one** component, so the control grows out of itself. Same height and right edge in both states — this is what stops a grid reflowing on Add. |
| `ui/wordmark.tsx` | The OnlineMall lockup, set in type rather than artwork. |
| `product-card.tsx` | The most-repeated component in the app. Memoised on the values that change; fixed two-line name box so Add buttons share a baseline across the grid. |
| `features/catalogue/product-types.ts` | `Store`, `Product`, `ProductCategory` — the contract Phase 2's API must satisfy. |

## Accessibility

4.5:1 minimum for text. Any green carrying white text is `primary`, which passes;
`brand` is surface only. 44pt minimum targets — the stepper is a 32pt pill with
`hitSlop` extending it past 44. The stepper is an `adjustable` role with a live
value. Icon-only actions carry labels. Reduce Motion is honoured throughout. Dynamic
Type to 200% with product names truncating at two lines.

## Open deviations

1. The home header gradient carries white text at roughly 2:1. Inherited from the
   Chowly system as a deliberate brand choice. Mitigation available and unapplied: a
   `rgba(6,34,20,0.18)` scrim behind the header text block.
2. `expo-haptics` is stubbed, so no device currently vibrates.
3. Dark theme values are designed but have not been reviewed on a device.
