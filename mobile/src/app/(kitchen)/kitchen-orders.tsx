import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdvanceKitchenOrder, useKitchenOrders } from "@/features/kitchen/use-kitchen";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const FILTERS: [string, string][] = [
  ["", "All"],
  ["confirmed", "New"],
  ["preparing", "Cooking"],
  ["ready", "Ready"],
  ["out_for_delivery", "Out"],
  ["delivered", "Done"],
];

const STATUS_LABEL: Record<string, string> = {
  cancelled: "Cancelled",
  confirmed: "New",
  delivered: "Delivered",
  out_for_delivery: "With rider",
  payment_failed: "Payment failed",
  pending_payment: "Awaiting payment",
  preparing: "Cooking",
  ready: "Ready",
};

const NEXT_ACTION: Record<string, { label: string; status: "preparing" | "ready" } | undefined> = {
  confirmed: { label: "Start cooking", status: "preparing" },
  preparing: { label: "Ready", status: "ready" },
};

/**
 * The kitchen's order book.
 *
 * Unlike the counter, this is the whole history rather than what is cooking —
 * so the card is compact. The action is still here, though, because filtering
 * to "New" and working down the list is how a kitchen catches up after a rush.
 */
export default function KitchenOrdersScreen() {
  const [status, setStatus] = useState("");
  const { data: orders, isLoading, isError, refetch } = useKitchenOrders(status || undefined);
  const advance = useAdvanceKitchenOrder();

  const act = async (orderId: string, next: "preparing" | "ready") => {
    try {
      await advance.mutateAsync({ orderId, status: next });
    } catch (error) {
      toast.error("Could not update that order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <Screen edges={["top"]}>
      <View className="px-gutter pt-4">
        <Text accessibilityRole="header" className="font-title text-display text-foreground">
          Orders
        </Text>
      </View>

      <ScrollView
        className="mt-3 max-h-12"
        contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {FILTERS.map(([value, label]) => {
          const selected = status === value;

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`h-9 items-center justify-center rounded-pill border px-4 ${
                selected
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface active:bg-muted"
              }`}
              key={label}
              onPress={() => setStatus(value)}
            >
              <Text
                className={`text-label ${
                  selected ? "font-heading text-primary" : "font-label text-text-secondary"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View className="gap-3 px-gutter pt-4">
            {[0, 1, 2, 3].map((key) => (
              <Skeleton className="h-20 rounded-card" key={key} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            message="We could not load your order book. Check your connection and try again."
            onRetry={() => void refetch()}
            title="Orders unavailable"
          />
        ) : (orders ?? []).length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            message={
              status
                ? "Nothing in this state right now. Try another filter."
                : "Orders placed with your kitchen appear here as they come in."
            }
            title="No orders"
            {...(status ? { actionLabel: "Show all", onAction: () => setStatus("") } : {})}
          />
        ) : (
          <View className="gap-2 px-gutter pt-4">
            {(orders ?? []).map((order) => {
              const next = NEXT_ACTION[order.status];

              return (
                <View className="gap-3 rounded-card bg-surface p-4" key={order._id}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-heading text-body text-foreground">
                        {order.reference}
                      </Text>
                      <Text className="font-sans text-caption text-text-muted" numberOfLines={1}>
                        {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                        {order.contactName}
                        {order.paymentMethod === "cod" ? " · Cash" : ""}
                      </Text>
                    </View>

                    <View className="items-end">
                      <Text
                        className="font-title text-price text-foreground"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {formatPrice(order.total)}
                      </Text>
                      <Text className="font-label text-caption text-text-secondary">
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Text>
                    </View>
                  </View>

                  {next ? (
                    <Pressable
                      accessibilityLabel={`${next.label} for ${order.reference}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: advance.isPending }}
                      className="h-11 items-center justify-center rounded-input border border-primary active:bg-primary-soft"
                      disabled={advance.isPending}
                      onPress={() => void act(order._id, next.status)}
                    >
                      <Text className="font-heading text-label text-primary">{next.label}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
