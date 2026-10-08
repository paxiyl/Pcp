import type { OrderStatus } from "@/lib/api";

/**
 * The single source of truth for how an order status looks anywhere in the
 * backoffice: badges, donut segments and legend dots all read from here, so a
 * status can never mean teal in one place and grey in another.
 *
 * Hues follow the design — blue confirmed, orange preparing, amber ready, teal
 * on the way, green delivered, red cancelled — at a lightness that works both
 * as a dot and as text on its own 12% tint.
 */
export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string }> = {
  pending_payment: { color: "oklch(0.58 0 0)", label: "Awaiting payment" },
  payment_failed: { color: "oklch(0.58 0.20 25)", label: "Payment failed" },
  confirmed: { color: "oklch(0.55 0.16 255)", label: "Confirmed" },
  preparing: { color: "oklch(0.63 0.15 55)", label: "Preparing" },
  ready: { color: "oklch(0.66 0.14 80)", label: "Ready" },
  out_for_delivery: { color: "oklch(0.56 0.12 175)", label: "On the way" },
  delivered: { color: "oklch(0.57 0.14 150)", label: "Delivered" },
  cancelled: { color: "oklch(0.58 0.20 25)", label: "Cancelled" },
};

/** Tinted background plus matching text, derived from the one colour above. */
export const tintedStyle = (color: string) => ({
  backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
  color,
});

export const statusStyle = (status: OrderStatus) => tintedStyle(ORDER_STATUS[status].color);

/** Payment state is not an order status, but it reads as the same kind of chip. */
export const PAYMENT_COLORS = {
  paid: "oklch(0.57 0.14 150)",
  unpaid: "oklch(0.58 0 0)",
};
