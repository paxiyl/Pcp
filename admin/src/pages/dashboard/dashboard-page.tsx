import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LiveOperations } from "@/components/dashboard/live-operations";
import { OrdersByStatus } from "@/components/dashboard/orders-by-status";
import { RevenueSplitCard } from "@/components/dashboard/revenue-split-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { StatCards } from "@/components/dashboard/stat-cards";
import { Button } from "@/components/ui/button";
import { useOverview } from "@/features/analytics/use-overview";
import { useSession } from "@/features/auth/use-session";

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
};

export function DashboardPage() {
  const { user } = useSession();
  const [days, setDays] = useState(7);
  const { data, isLoading } = useOverview(days);

  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground">Here is what is happening across Raket today.</p>
        </div>

        <Button
          onClick={() =>
            toast("Export is not built yet", {
              description: "The API has no report export endpoint.",
            })
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Export report
        </Button>
      </div>

      <StatCards isLoading={isLoading} today={data?.today} yesterday={data?.yesterday} />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <RevenueChart
          days={days}
          isLoading={isLoading}
          onDaysChange={setDays}
          series={data?.series}
        />
        <OrdersByStatus data={data?.byStatus} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <RecentOrders isLoading={isLoading} orders={data?.recent} />
        <LiveOperations events={data?.activity} isLoading={isLoading} />
      </div>

      <RevenueSplitCard
        isLoading={isLoading}
        paymentSplit={data?.paymentSplit}
        vendorSplit={data?.vendorSplit}
      />
    </div>
  );
}
