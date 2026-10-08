import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { RevenuePoint } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const config = {
  revenue: { color: "var(--chart-1)", label: "Revenue" },
  commission: { color: "var(--chart-2)", label: "Commission" },
} satisfies ChartConfig;

const RANGES = [7, 30, 90];

type Props = {
  series?: RevenuePoint[];
  days: number;
  onDaysChange: (days: number) => void;
  isLoading?: boolean;
};

export function RevenueChart({ series, days, onDaysChange, isLoading }: Props) {
  // Money is stored in cents; the axis reads in whole currency.
  const data = (series ?? []).map((point) => ({
    commission: point.commission / 100,
    label: new Date(point.date).toLocaleDateString(undefined, {
      day: days > 7 ? "numeric" : undefined,
      month: days > 7 ? "short" : undefined,
      weekday: days > 7 ? undefined : "short",
    }),
    revenue: point.revenue / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue overview</CardTitle>
        <CardDescription>Gross revenue and commission</CardDescription>

        <CardAction>
          <ToggleGroup
            className="bg-muted rounded-lg p-1"
            onValueChange={(value) => value && onDaysChange(Number(value))}
            size="sm"
            type="single"
            value={String(days)}
          >
            {RANGES.map((range) => (
              <ToggleGroupItem
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md px-3 text-xs font-medium data-[state=on]:shadow-sm"
                key={range}
                value={String(range)}
              >
                {range} days
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <ChartContainer className="h-[260px] w-full" config={config}>
            <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                {(["revenue", "commission"] as const).map((key) => (
                  <linearGradient id={`fill-${key}`} key={key} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor={config[key].color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={config[key].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} />
              <YAxis
                axisLine={false}
                tickFormatter={(value: number) => formatMoney(value * 100)}
                tickLine={false}
                width={70}
              />

              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatMoney(Number(value) * 100)}
                  />
                }
              />

              <Area
                dataKey="revenue"
                fill="url(#fill-revenue)"
                stroke={config.revenue.color}
                strokeWidth={2}
                type="monotone"
              />
              <Area
                dataKey="commission"
                fill="url(#fill-commission)"
                stroke={config.commission.color}
                strokeWidth={2}
                type="monotone"
              />

              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
