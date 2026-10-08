import { MoreHorizontalIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReleaseRider, useUpdateOrderStatus } from "@/features/orders/use-admin-orders";
import type { AdminOrderRow, OrderStatus } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { ORDER_STATUS } from "@/lib/order-status";

type Move = { status: "preparing" | "ready" | "cancelled"; label: string };

/**
 * Only the kitchen path is an admin's to move. Picking up and delivering belong
 * to the rider, so those transitions are never offered here.
 */
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

export function OrderActions({ order }: { order: AdminOrderRow }) {
  const navigate = useNavigate();
  const update = useUpdateOrderStatus();
  const release = useReleaseRider();
  const moves = MOVES[order.status] ?? [];

  // Only an order a rider is still carrying can be handed back to the queue.
  const canRelease =
    Boolean(order.driverName) &&
    (order.status === "ready" || order.status === "out_for_delivery");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${order.reference}`}
          // The row opens the order; the menu must not do it twice.
          onClick={(event) => event.stopPropagation()}
          size="icon"
          variant="ghost"
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>#{order.reference}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => void navigate(`/orders/${order._id}`)}>
            View details
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {moves.length > 0 ? (
            moves.map((move) => (
              <DropdownMenuItem
                disabled={update.isPending}
                key={move.status}
                onSelect={() =>
                  update.mutate(
                    { orderId: order._id, status: move.status },
                    {
                      onError: (error) =>
                        toast.error("Could not update the order", {
                          description:
                            error instanceof ApiError ? error.message : "Please try again.",
                        }),
                      onSuccess: () =>
                        toast.success(
                          `#${order.reference} is now ${ORDER_STATUS[move.status].label.toLowerCase()}`,
                        ),
                    },
                  )
                }
                variant={move.status === "cancelled" ? "destructive" : undefined}
              >
                {move.label}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {order.status === "delivered" || order.status === "cancelled"
                ? "This order is finished"
                : "Waiting on the rider"}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {canRelease ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={release.isPending}
                onSelect={() =>
                  release.mutate(order._id, {
                    onError: (error) =>
                      toast.error("Could not release the rider", {
                        description:
                          error instanceof ApiError ? error.message : "Please try again.",
                      }),
                    onSuccess: () =>
                      toast.success(`#${order.reference} is back on the rider queue`),
                  })
                }
              >
                Release rider
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
