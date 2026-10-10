/**
 * How a customer pays. Its own module, with no imports at all.
 *
 * It lived on `order.model` and was imported from there by `user.model`, which
 * closed a cycle: order.model → notification.service → user.model →
 * order.model. Whether that crashed depended on which model Node happened to
 * load first, which is not a thing to leave to chance.
 *
 * It is shared vocabulary rather than an order concept anyway — an order
 * records which was used, a customer records which they prefer — so this is
 * where it belongs.
 */
export const PAYMENT_METHODS = ["upi", "card", "netbanking", "wallet", "cod"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
