import { ArrowLeftIcon, BikeIcon, MapPinIcon, StoreIcon, UserIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { RefundDialog } from "@/components/orders/refund-dialog";
import { PaymentBadge } from "@/components/orders/payment-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useAdminOrder,
  useReleaseRider,
  useUpdateOrderStatus,
} from "@/features/orders/use-admin-orders";
import type { OrderStatus } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";

type Move = { status: "preparing" | "ready" | "cancelled"; label: string };

/** Only the kitchen path; pick-up and delivery belong to the rider app. */
const MOVES: Partial<Record<OrderStatus, Move[]>> = {
  confirmed: [
    { label: "Start preparing", status: "preparing" },
    { label: "Cancel order", status: "cancelled" },
  ],
  preparing: [
    { label: "Mark as ready", status: "ready" },
    { label: "Cancel order", status: "cancelled" },
  ],
  ready: [{ label: "Cancel order", status: "cancelled" }],
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value}</span>
  </div>
);

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { data: order, isLoading, error } = useAdminOrder(orderId ?? "");
  const update = useUpdateOrderStatus();
  const release = useReleaseRider();
  const [refundOpen, setRefundOpen] = useState(false);

  const back = (
    <Button asChild className="w-fit" size="sm" variant="ghost">
      <Link to="/orders">
        <ArrowLeftIcon data-icon="inline-start" />
        Back to orders
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Order not found</EmptyTitle>
            <EmptyDescription>
              {error instanceof ApiError ? error.message : "That order does not exist."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const placed = formatDateTime(order.createdAt);
  const moves = MOVES[order.status] ?? [];

  const OWNERSHIP: Partial<Record<OrderStatus, string>> = {
    cancelled: "This order was cancelled. Nothing further can be changed.",
    delivered: "This order is complete. Nothing further can be changed.",
    out_for_delivery:
      "The rider is carrying this order and confirms delivery with the customer code. Release it if they have gone quiet.",
    ready: "Waiting for a rider to claim it. Only cancelling is left to you.",
  };

  const refunded = order?.refundedAmount ?? 0;
  const fullyRefunded = Boolean(order && refunded >= order.total);
  // Cash orders are refundable too — the money just moves by hand, and recording
  // it is the only way the shop knows it owes anything.
  const canRefund =
    Boolean(order) &&
    !fullyRefunded &&
    (Boolean(order?.paidAt) || order?.paymentMethod === "cod");

  const canRelease =
    Boolean(order.driver) && (order.status === "ready" || order.status === "out_for_delivery");

  const ownership =
    moves.length > 0
      ? "You control the kitchen steps; the rider handles pick-up and delivery."
      : (OWNERSHIP[order.status] ?? "There is nothing to change on this order.");
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);

  const move = (next: Move) =>
    update.mutate(
      { orderId: order._id, status: next.status },
      {
        onError: (mutationError) =>
          toast.error("Could not update the order", {
            description:
              mutationError instanceof ApiError ? mutationError.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(`#${order.reference} is now ${ORDER_STATUS[next.status].label.toLowerCase()}`),
      },
    );

  return (
    <div className="flex flex-col gap-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">#{order.reference}</h1>
            <OrderStatusBadge status={order.status} />
            <PaymentBadge paidAt={order.paidAt} />
          </div>
          <p className="text-muted-foreground">
            Placed {placed.date} at {placed.time} · {itemCount}{" "}
            {itemCount === 1 ? "item" : "items"}
          </p>
        </div>

        {/* Always present, so it is clear who owns the next step even when
            there is nothing for an admin to do. */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Update status</span>

            <Select
              disabled={moves.length === 0 || update.isPending}
              onValueChange={(value) => {
                const next = moves.find((option) => option.status === value);
                if (next) move(next);
              }}
              value=""
            >
              <SelectTrigger className="w-56">
                {update.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="size-4" />
                    Updating…
                  </span>
                ) : (
                  <SelectValue
                    placeholder={
                      moves.length > 0 ? "Choose a new status" : ORDER_STATUS[order.status].label
                    }
                  />
                )}
              </SelectTrigger>

              <SelectContent>
                <SelectGroup>
                  {moves.map((option) => (
                    <SelectItem key={option.status} value={option.status}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {canRelease ? (
            <Button
              disabled={release.isPending}
              onClick={() =>
                release.mutate(order._id, {
                  onError: (releaseError) =>
                    toast.error("Could not release the rider", {
                      description:
                        releaseError instanceof ApiError
                          ? releaseError.message
                          : "Please try again.",
                    }),
                  onSuccess: () =>
                    toast.success(`#${order.reference} is back on the rider queue`),
                })
              }
              size="sm"
              variant="outline"
            >
              {release.isPending ? <Spinner data-icon="inline-start" /> : null}
              Release rider
            </Button>
          ) : null}

          {/* Only an order that actually took money can give any back. */}
          {canRefund ? (
            <Button onClick={() => setRefundOpen(true)} size="sm" variant="outline">
              {fullyRefunded ? "Refunded" : "Refund"}
            </Button>
          ) : null}

          <p className="text-muted-foreground max-w-xs text-right text-xs">{ownership}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {order.items.map((item) => (
                <div className="flex items-start justify-between gap-4" key={item._id}>
                  <div className="flex gap-3">
                    <span className="text-primary font-semibold">×{item.quantity}</span>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.name}</span>
                      {item.optionNames.length > 0 ? (
                        <span className="text-muted-foreground text-sm">
                          {item.optionNames.join(", ")}
                        </span>
                      ) : null}
                      {item.note ? (
                        <span className="text-muted-foreground text-xs">Note: {item.note}</span>
                      ) : null}
                    </div>
                  </div>
                  <span className="font-medium">{formatMoney(item.unitPrice * item.quantity)}</span>
                </div>
              ))}

              {order.includeCutlery ? (
                <p className="text-muted-foreground text-sm">Cutlery requested</p>
              ) : null}
              {order.orderNote ? (
                <p className="bg-muted rounded-md p-3 text-sm">{order.orderNote}</p>
              ) : null}

              <Separator />

              <div className="flex flex-col gap-2">
                <Row label="Subtotal" value={formatMoney(order.subtotal)} />
                <Row
                  label="Delivery fee"
                  value={order.deliveryFee === 0 ? "Free" : formatMoney(order.deliveryFee)}
                />
                <Row label="Service fee" value={formatMoney(order.serviceFee)} />
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Customer paid</span>
                  <span className="text-xl font-bold">{formatMoney(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* The split behind the order: what each party takes from it. */}
          <Card>
            <CardHeader>
              <CardTitle>Money split</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Row
                label={`Commission (${Math.round(order.commissionRate * 100)}%)`}
                value={formatMoney(order.commission)}
              />
              <Row label="Restaurant payout" value={formatMoney(order.restaurantPayout)} />
              <Row
                label="Rider payout"
                value={order.driverPayout ? formatMoney(order.driverPayout.total) : "Not claimed"}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={order.statusHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex gap-3">
                <UserIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{order.contactName}</span>
                  <span className="text-muted-foreground">
                    {order.contactPhone ?? "No phone number"}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <StoreIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{order.restaurantName}</span>
                  {order.restaurantAddress ? (
                    <span className="text-muted-foreground">{order.restaurantAddress}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-3">
                <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    {[order.deliveryAddress.line1, order.deliveryAddress.line2]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  <span className="text-muted-foreground">
                    {order.deliveryAddress.city}, {order.deliveryAddress.postcode}
                  </span>
                  {order.deliveryAddress.instructions ? (
                    <span className="text-muted-foreground text-xs">
                      {order.deliveryAddress.instructions}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-3">
                <BikeIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">{order.driver?.name ?? "No rider yet"}</span>
                  <span className="text-muted-foreground">
                    {order.driver?.phone ?? "Unassigned until a rider claims it"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {order ? (
        <RefundDialog
          alreadyRefunded={refunded}
          onOpenChange={setRefundOpen}
          open={refundOpen}
          orderId={order._id}
          paymentMethod={order.paymentMethod}
          reference={order.reference}
          total={order.total}
        />
      ) : null}
    </div>
  );
}
