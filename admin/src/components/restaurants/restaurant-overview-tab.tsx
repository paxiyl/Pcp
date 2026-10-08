import { StarIcon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useUpdateRestaurant } from "@/features/restaurants/use-admin-restaurants";
import type { AdminRestaurantDetail, AdminRestaurantProfile } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatMoney } from "@/lib/format";

type Props = {
  restaurant: AdminRestaurantProfile;
  stats: AdminRestaurantDetail["stats"];
  defaultCommissionRate: number;
};

/** A label/value line; the design separates every row but the last. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b py-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="flex items-center gap-2 text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export function RestaurantOverviewTab({ restaurant, stats, defaultCommissionRate }: Props) {
  const update = useUpdateRestaurant();

  const rate = restaurant.commissionRate ?? defaultCommissionRate;

  const toggleOpen = (isOpen: boolean) =>
    update.mutate(
      { id: restaurant._id, isOpen },
      {
        onError: (error) =>
          toast.error("Could not change availability", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(isOpen ? "Now accepting orders" : "Orders paused"),
      },
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders today" value={stats.ordersToday} />
        <StatCard label="Revenue today" value={formatMoney(stats.revenueToday)} />
        <StatCard label="Active dishes" value={stats.activeDishes} />
        <StatCard
          label="Average rating"
          value={
            <>
              <StarIcon className="size-6 fill-amber-500 text-amber-500" />
              {restaurant.rating.toFixed(1)}
            </>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Restaurant information</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-6 sm:flex-row">
              {restaurant.imageUrl ? (
                <img
                  alt=""
                  className="h-32 w-32 shrink-0 rounded-xl border object-cover"
                  src={restaurant.imageUrl}
                />
              ) : null}

              <div className="flex-1 text-sm">
                <Row label="Name" value={restaurant.name} />
                <Row label="Cuisine" value={restaurant.cuisines.join(", ") || "—"} />
                <Row label="Address" value={restaurant.address || "—"} />
                <Row
                  label="Description"
                  value={restaurant.description || <span className="font-normal">—</span>}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <p className="font-medium">Restaurant availability</p>
                <p className="text-muted-foreground text-sm">
                  {restaurant.isOpen
                    ? `Accepting orders · Closes ${restaurant.closesAt}`
                    : "Paused — customers cannot order right now"}
                </p>
              </div>

              <Switch
                aria-label="Accepting orders"
                checked={restaurant.isOpen}
                disabled={update.isPending}
                onCheckedChange={toggleOpen}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Delivery settings</CardTitle>
          </CardHeader>

          <CardContent className="text-sm">
            <Row
              label="Delivery fee"
              value={
                restaurant.deliveryFee === 0 ? "Free" : formatMoney(restaurant.deliveryFee)
              }
            />
            <Row label="Minimum order" value={formatMoney(restaurant.minOrder)} />
            <Row
              label="Preparation time"
              value={`${restaurant.prepTimeMinMinutes}–${restaurant.prepTimeMaxMinutes} min`}
            />
            <Row
              label="Free delivery over"
              value={
                restaurant.freeDeliveryThreshold
                  ? formatMoney(restaurant.freeDeliveryThreshold)
                  : "Never"
              }
            />
            <Row
              label="Commission"
              value={
                <>
                  {Math.round(rate * 100)}%
                  {restaurant.commissionRate === undefined ? (
                    <span className="text-muted-foreground ml-1 text-xs font-normal">default</span>
                  ) : null}
                </>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
