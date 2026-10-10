import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";
import { useLogout } from "@/features/auth/use-auth";
import {
  useAdvanceKitchenOrder,
  useKitchenOverview,
  useSetKitchenOpen,
} from "@/features/kitchen/use-kitchen";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

/** What the kitchen does next, per status. Dispatch belongs to the rider. */
const NEXT_ACTION: Record<string, { label: string; status: "preparing" | "ready" } | undefined> = {
  confirmed: { label: "Start cooking", status: "preparing" },
  preparing: { label: "Food is ready", status: "ready" },
};

/**
 * The kitchen counter.
 *
 * One screen for the whole of service: are we open, what have we taken today,
 * and what is on the stove. The order cards carry their own action, because
 * during a rush nobody is navigating to a detail screen to press one button.
 */
export default function KitchenCounterScreen() {
  const logout = useLogout();
  const [primary, warning, secondary] = useCSSVariable([
    "--color-primary",
    "--color-warning",
    "--color-text-secondary",
  ]);

  const { data, isLoading, isError, refetch, isRefetching } = useKitchenOverview();
  const advance = useAdvanceKitchenOrder();
  const setOpen = useSetKitchenOpen();

  const act = async (orderId: string, status: "preparing" | "ready") => {
    try {
      await advance.mutateAsync({ orderId, status });
    } catch (error) {
      toast.error("Could not update that order", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <Screen edges={["top"]}>
        <View className="gap-4 px-gutter pt-5">
          <SkeletonLine height={24} width="55%" />
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-40 rounded-card" />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen edges={["top"]}>
        <ErrorState
          message="We could not load your kitchen. Check your connection and try again."
          onRetry={() => void refetch()}
          title="Kitchen unavailable"
        />
      </Screen>
    );
  }

  const { openOrders, restaurant, today, unavailable } = data;

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            onRefresh={() => void refetch()}
            refreshing={isRefetching}
            tintColor={primary as string}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-start justify-between gap-3 px-gutter pt-4">
          <View className="flex-1">
            <Text accessibilityRole="header" className="font-title text-display text-foreground">
              {restaurant.name}
            </Text>
            <Text className="font-sans text-label text-text-secondary">
              {restaurant.cuisines?.join(" · ")}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center"
            hitSlop={8}
            onPress={() =>
              Alert.alert("Sign out?", "You will need to sign in again to see your orders.", [
                { style: "cancel", text: "Stay signed in" },
                { onPress: () => logout.mutate(), style: "destructive", text: "Sign out" },
              ])
            }
          >
            <Ionicons color={secondary as string} name="log-out-outline" size={22} />
          </Pressable>
        </View>

        {/* The switch a kitchen reaches for most: stop the orders when the gas
            runs out, without ringing anyone. Being LISTED stays with the admin. */}
        <View className="mx-gutter mt-4 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3">
          <Ionicons
            color={(restaurant.isOpen ? primary : secondary) as string}
            name={restaurant.isOpen ? "restaurant" : "restaurant-outline"}
            size={22}
          />
          <View className="flex-1">
            <Text className="font-label text-body text-foreground">
              {restaurant.isOpen ? "Taking orders" : "Closed"}
            </Text>
            <Text className="font-sans text-caption text-text-muted">
              {restaurant.isOpen
                ? "Customers can order from you right now."
                : "You still appear in the app, greyed out."}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Taking orders"
            disabled={setOpen.isPending}
            onValueChange={(value) => void setOpen.mutateAsync(value).catch(() => undefined)}
            value={restaurant.isOpen}
          />
        </View>

        <View className="mx-gutter mt-3 flex-row gap-3">
          <View className="flex-1 rounded-card bg-surface px-4 py-3">
            <Text className="font-sans text-caption text-text-muted">Orders today</Text>
            <Text
              className="font-title text-display text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {today.orders}
            </Text>
          </View>
          <View className="flex-1 rounded-card bg-surface px-4 py-3">
            <Text className="font-sans text-caption text-text-muted">Takings today</Text>
            <Text
              className="font-title text-display text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(today.revenue)}
            </Text>
          </View>
        </View>

        {/* A dish switched off is a sale not happening, so it is worth a line
            here rather than only on the menu tab. */}
        {unavailable > 0 ? (
          <View className="mx-gutter mt-3 flex-row items-center gap-3 rounded-card bg-warning-soft px-4 py-3">
            <Ionicons color={warning as string} name="alert-circle-outline" size={20} />
            <Text className="flex-1 font-sans text-label text-text-secondary">
              {unavailable} {unavailable === 1 ? "dish is" : "dishes are"} switched off and cannot
              be ordered. Turn them back on from the Menu tab.
            </Text>
          </View>
        ) : null}

        <View className="pt-7">
          <SectionHeader
            subtitle={openOrders.length === 0 ? undefined : "Oldest first is the queue order"}
            title={`On the stove (${openOrders.length})`}
          />

          {openOrders.length === 0 ? (
            <EmptyState
              compact
              icon="checkmark-done-outline"
              message="Nothing is waiting. New orders appear here on their own."
              title="All caught up"
            />
          ) : (
            <View className="gap-3 px-gutter">
              {openOrders.map((order) => {
                const next = NEXT_ACTION[order.status];
                const cash = order.paymentMethod === "cod";

                return (
                  <View className="gap-3 rounded-card bg-surface p-4" key={order._id}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="font-heading text-body text-foreground">
                          {order.reference}
                        </Text>
                        <Text className="font-sans text-caption text-text-muted">
                          {order.contactName}
                          {cash ? " · Cash on delivery" : ""}
                        </Text>
                      </View>
                      <Text
                        className="font-title text-price text-foreground"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {formatPrice(order.total)}
                      </Text>
                    </View>

                    {/* The ticket itself. A kitchen cooks from this, so the
                        lines are spelled out rather than counted. */}
                    <View className="gap-1.5 border-t border-border pt-3">
                      {order.items.map((item) => (
                        <View className="flex-row items-start gap-2" key={item._id}>
                          <Text className="w-7 font-heading text-body text-primary">
                            ×{item.quantity}
                          </Text>
                          <View className="flex-1">
                            <Text className="font-label text-body text-foreground">
                              {item.name}
                            </Text>
                            {item.optionNames.length > 0 ? (
                              <Text className="font-sans text-caption text-text-muted">
                                {item.optionNames.join(", ")}
                              </Text>
                            ) : null}
                            {item.note ? (
                              <Text className="font-sans text-caption text-warning">
                                Note: {item.note}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}

                      {order.orderNote ? (
                        <Text className="mt-1 font-sans text-caption text-warning">
                          Order note: {order.orderNote}
                        </Text>
                      ) : null}
                    </View>

                    {next ? (
                      <Pressable
                        accessibilityLabel={`${next.label} for ${order.reference}`}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: advance.isPending }}
                        className="h-12 items-center justify-center rounded-input bg-primary active:bg-primary-pressed"
                        disabled={advance.isPending}
                        onPress={() => void act(order._id, next.status)}
                      >
                        <Text className="font-heading text-body text-primary-foreground">
                          {next.label}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text className="font-sans text-caption text-text-muted">
                        {order.status === "ready"
                          ? "Waiting for a rider to collect."
                          : "With the rider."}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
