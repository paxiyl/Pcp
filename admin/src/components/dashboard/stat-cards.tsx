import {
  ArrowDownIcon,
  ArrowUpIcon,
  BikeIcon,
  CoinsIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Totals } from "@/lib/api";
import { formatMoney, percentChange } from "@/lib/format";
import { cn } from "@/lib/utils";

type Stat = {
  icon: typeof ShoppingCartIcon;
  label: string;
  value: string;
  change: number | null;
};

const buildStats = (today: Totals, yesterday: Totals): Stat[] => [
  {
    change: percentChange(today.orders, yesterday.orders),
    icon: ShoppingCartIcon,
    label: "Today's orders",
    value: String(today.orders),
  },
  {
    change: percentChange(today.revenue, yesterday.revenue),
    icon: TrendingUpIcon,
    label: "Gross revenue",
    value: formatMoney(today.revenue),
  },
  {
    change: percentChange(today.commission, yesterday.commission),
    icon: CoinsIcon,
    label: "Commission earned",
    value: formatMoney(today.commission),
  },
  {
    change: percentChange(today.riderPayouts, yesterday.riderPayouts),
    icon: BikeIcon,
    label: "Rider payouts",
    value: formatMoney(today.riderPayouts),
  },
  {
    change: percentChange(today.averageOrderValue, yesterday.averageOrderValue),
    icon: ReceiptIcon,
    label: "Average order value",
    value: formatMoney(today.averageOrderValue),
  },
];

type Props = { today?: Totals; yesterday?: Totals; isLoading?: boolean };

export function StatCards({ today, yesterday, isLoading }: Props) {
  const stats = today && yesterday ? buildStats(today, yesterday) : [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {isLoading || stats.length === 0
        ? Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        : stats.map(({ change, icon: Icon, label, value }) => (
            <Card key={label}>
              <CardContent className="flex flex-col gap-4">
                {/* Icon beside the figure, matching the design's card. */}
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </div>

                  <div className="flex min-w-0 flex-col">
                    <p className="text-muted-foreground truncate text-sm">{label}</p>
                    <p className="text-2xl font-bold tracking-tight">{value}</p>
                  </div>
                </div>

                {change === null ? (
                  <p className="text-muted-foreground text-xs">No baseline yesterday</p>
                ) : (
                  <p className="flex items-center gap-1 text-xs">
                    <span
                      className={cn(
                        "flex items-center gap-0.5 font-semibold",
                        change >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {change >= 0 ? (
                        <ArrowUpIcon className="size-3.5" />
                      ) : (
                        <ArrowDownIcon className="size-3.5" />
                      )}
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground">vs yesterday</span>
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
    </div>
  );
}
