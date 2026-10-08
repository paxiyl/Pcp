import { ClockIcon, ReceiptTextIcon, TrendingUpIcon, TruckIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminOrderStats } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const build = (stats: AdminOrderStats) => [
  { icon: ReceiptTextIcon, label: "Orders today", value: String(stats.ordersToday) },
  { icon: ClockIcon, label: "Awaiting action", value: String(stats.awaitingAction) },
  { icon: TruckIcon, label: "On delivery", value: String(stats.onDelivery) },
  { icon: TrendingUpIcon, label: "Revenue today", value: formatMoney(stats.revenueToday) },
];

export function OrderStatCards({ stats, isLoading }: { stats?: AdminOrderStats; isLoading?: boolean }) {
  const cards = stats ? build(stats) : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {isLoading || cards.length === 0
        ? Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-xl" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        : cards.map(({ icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </div>
                <div className="flex min-w-0 flex-col">
                  <p className="text-muted-foreground truncate text-sm">{label}</p>
                  <p className="text-2xl font-bold tracking-tight">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}
