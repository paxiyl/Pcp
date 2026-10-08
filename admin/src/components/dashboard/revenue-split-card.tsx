import { BanknoteIcon, StoreIcon, UtensilsIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaymentSplit, VendorSplit } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type Props = {
  vendorSplit?: VendorSplit[];
  paymentSplit?: PaymentSplit[];
  isLoading: boolean;
};

const METHOD_LABELS: Record<string, string> = {
  card: "Card",
  cod: "Cash on delivery",
  netbanking: "Netbanking",
  upi: "UPI",
  wallet: "Wallet",
};

/** Proportional bar. Percentages are the point here; the axis would only repeat them. */
function Bar({ share, tone }: { share: number; tone: string }) {
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${share}%` }} />
    </div>
  );
}

/**
 * Where the money came from, and how it was paid.
 *
 * The headline totals always counted every paid order whatever the vendor — the
 * gap was being unable to see which half was which. Once shops outgrow
 * restaurants, that split is the number the business turns on.
 *
 * The COD row doubles as an operational figure: it is the cash riders are
 * carrying around Hindaun.
 */
export function RevenueSplitCard({ vendorSplit, paymentSplit, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Where revenue came from</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const vendors = vendorSplit ?? [];
  const payments = paymentSplit ?? [];
  const vendorTotal = vendors.reduce((sum, row) => sum + row.revenue, 0);
  const paymentTotal = payments.reduce((sum, row) => sum + row.revenue, 0);

  if (vendorTotal === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Where revenue came from</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No paid orders in this period yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cod = payments.find((row) => row.paymentMethod === "cod");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where revenue came from</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          {vendors.map((row) => {
            const share = Math.round((row.revenue / vendorTotal) * 100);
            const shop = row.vendorKind === "store";

            return (
              <div className="flex flex-col gap-1.5" key={row.vendorKind}>
                <div className="flex items-center gap-2 text-sm">
                  {shop ? (
                    <StoreIcon className="size-4 shrink-0" />
                  ) : (
                    <UtensilsIcon className="size-4 shrink-0" />
                  )}
                  <span className="font-medium">{shop ? "Shops" : "Restaurants"}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {row.orders} order{row.orders === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums">
                    {formatMoney(row.revenue)}
                  </span>
                  <span className="text-muted-foreground w-10 text-right tabular-nums">
                    {share}%
                  </span>
                </div>
                <Bar share={share} tone={shop ? "bg-primary" : "bg-primary/40"} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t pt-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">How customers paid</p>
            {cod ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-600">
                <BanknoteIcon className="size-3.5" />
                {formatMoney(cod.revenue)} carried as cash
              </span>
            ) : null}
          </div>

          {payments.map((row) => {
            const share = Math.round((row.revenue / paymentTotal) * 100);

            return (
              <div className="flex flex-col gap-1.5" key={row.paymentMethod}>
                <div className="flex items-center gap-2 text-sm">
                  <span>{METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod}</span>
                  <span className="ml-auto tabular-nums">{formatMoney(row.revenue)}</span>
                  <span className="text-muted-foreground w-10 text-right tabular-nums">
                    {share}%
                  </span>
                </div>
                <Bar
                  share={share}
                  tone={row.paymentMethod === "cod" ? "bg-amber-500" : "bg-primary/60"}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
