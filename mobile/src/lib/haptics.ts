/**
 * Haptics, behind one seam.
 *
 * `expo-haptics` is NOT currently a dependency of this app, and the Uniwind/Expo
 * skill in this repo says not to install animation or feedback infrastructure
 * without asking. So this module is a working no-op today and a one-line swap
 * tomorrow:
 *
 *   npx expo install expo-haptics
 *
 * then replace the bodies below with `Haptics.impactAsync(...)` /
 * `Haptics.notificationAsync(...)`. Every call site is already correct, so
 * nothing else has to change.
 *
 * The rule the call sites follow: a haptic marks a committed, meaningful change
 * — an item entering the basket, an order paid for, a delivery confirmed. Not
 * scrolling, not navigation, not every tap.
 */

/** A product entered or left the basket; a chip was selected. */
export function selection(): void {}

/** An order was placed, a payment cleared, a delivery was confirmed. */
export function success(): void {}

/** A destructive or rejected action: card declined, item unavailable. */
export function warning(): void {}
