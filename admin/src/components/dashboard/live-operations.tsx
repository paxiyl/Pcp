import { ArrowRightIcon, BikeIcon, CheckCircle2Icon, PackageIcon, UtensilsIcon } from "lucide-react";
import { Link } from "react-router";

import { ORDER_STATUS } from "@/lib/order-status";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityEvent, OrderStatus } from "@/lib/api";
import { formatAgo } from "@/lib/format";

const ICONS: Partial<Record<OrderStatus, typeof PackageIcon>> = {
  confirmed: CheckCircle2Icon,
  delivered: CheckCircle2Icon,
  out_for_delivery: BikeIcon,
  preparing: UtensilsIcon,
  ready: PackageIcon,
};

/** Reconstructed from each order's status history; there is no events feed. */
export function LiveOperations({
  events,
  isLoading,
}: {
  events?: ActivityEvent[];
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live operations</CardTitle>
        <CardAction>
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="bg-success size-2 rounded-full" />
            Updating live
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div className="flex items-center gap-3 py-2" key={index}>
              <Skeleton className="size-9 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))
        ) : events && events.length > 0 ? (
          events.map((event, index) => {
            const Icon = ICONS[event.status] ?? PackageIcon;

            return (
              <div className="flex items-center gap-3 py-2" key={`${event.orderId}-${index}`}>
                <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </div>
                <p className="flex-1 text-sm">
                  <span className="font-medium">#{event.reference}</span>{" "}
                  {event.note ?? ORDER_STATUS[event.status].label.toLowerCase()}
                  <span className="text-muted-foreground"> · {event.restaurantName}</span>
                </p>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatAgo(event.at)}
                </span>
              </div>
            );
          })
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nothing happening yet</EmptyTitle>
              <EmptyDescription>Order activity shows up here as it happens.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>

      <CardFooter>
        <Link
          className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
          to="/orders"
        >
          Open live orders
          <ArrowRightIcon className="size-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
