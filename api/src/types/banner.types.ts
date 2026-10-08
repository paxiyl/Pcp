/** Derived banner state, from its schedule and its switch. */

/** What a banner is doing right now, derived from its window and its switch. */
export type BannerState = "active" | "scheduled" | "expired" | "draft";
