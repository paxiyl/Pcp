import { Cell, Label, Pie, PieChart } from "recharts";

import { ORDER_STATUS } from "@/lib/order-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderStatus, StatusCount } from "@/lib/api";


const config = {} satisfies ChartConfig;

export function OrdersByStatus({ data, isLoading }: { data?: StatusCount[]; isLoading?: boolean }) {
  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders by status</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 items-center">
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : total === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">No paid orders yet.</p>
        ) : (
          <div className="flex w-full flex-col items-center gap-6 sm:flex-row">
            <ChartContainer className="aspect-square h-[200px]" config={config}>
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="status"
                      labelFormatter={(_value, payload) =>
                        ORDER_STATUS[payload?.[0]?.payload?.status as OrderStatus]?.label
                      }
                    />
                  }
                />
                <Pie data={rows} dataKey="count" innerRadius={62} nameKey="status" strokeWidth={2}>
                  {rows.map((row) => (
                    <Cell fill={ORDER_STATUS[row.status].color} key={row.status} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;

                      return (
                        <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                          <tspan
                            className="fill-foreground text-2xl font-bold"
                            x={viewBox.cx}
                            y={viewBox.cy}
                          >
                            {total}
                          </tspan>
                          <tspan
                            className="fill-muted-foreground text-xs"
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 20}
                          >
                            Orders
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <ul className="flex flex-1 flex-col gap-3">
              {rows.map((row) => (
                <li className="flex items-center gap-3" key={row.status}>
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ORDER_STATUS[row.status].color }}
                  />
                  <span className="flex-1 text-sm">{ORDER_STATUS[row.status].label}</span>
                  <span className="text-sm font-semibold tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
