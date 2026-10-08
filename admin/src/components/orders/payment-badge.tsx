import { Badge } from "@/components/ui/badge";
import { PAYMENT_COLORS, tintedStyle } from "@/lib/order-status";

/** Paid reads green like the design; nothing is refundable yet, so that is the only positive state. */
export function PaymentBadge({ paidAt }: { paidAt?: string }) {
  const color = paidAt ? PAYMENT_COLORS.paid : PAYMENT_COLORS.unpaid;

  return (
    <Badge className="border-transparent font-medium" style={tintedStyle(color)} variant="secondary">
      {paidAt ? "Paid" : "Unpaid"}
    </Badge>
  );
}
