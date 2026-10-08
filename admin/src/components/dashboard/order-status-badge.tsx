import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/api";
import { ORDER_STATUS, statusStyle } from "@/lib/order-status";

/** Dot plus tinted chip, matching the design. Colours come from lib/order-status. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge
      className="gap-1.5 border-transparent font-medium"
      style={statusStyle(status)}
      variant="secondary"
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: ORDER_STATUS[status].color }}
      />
      {ORDER_STATUS[status].label}
    </Badge>
  );
}
