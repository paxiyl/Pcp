import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";
import { useLogout } from "@/features/auth/use-auth";
import {
  useAdvanceStoreOrder,
  useSetStoreOpen,
  useStoreOverview,
} from "@/features/store-owner/use-store-owner";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

/** What the shop does next, per status. Dispatch belongs to the rider. */
const NEXT_ACTION: Record<string, { label: string; status: "preparing" | "ready" } | undefined> = {
  confirmed: { label: "Start preparing", status: "preparing" },
  preparing: { label: "Mark ready", status: "ready" },
};

export default function StoreDashboardScreen() {
  const router = useRouter();
  const logout = useLogout();
  const [primary, warning, error, secondary] = useCSSVariable([
    "--color-primary",
    "--color-warning",
    "--color-error",
    "--color-text-secondary",
  ]);

  const { data, isLoading, isError, refetch, isRefetching } = useStoreOverview();
  const advance = useAdvanceStoreOrder();
  const setOpen = useSetStoreOpen();

  const act = async (orderId: string, status: "preparing" | "ready") => {
    try {
      await advance.mutateAsync({ orderId, status });
    } catch (err) {
      toast.error("Could not update that order", {
        description: err instanceof Error ? err.message : "Please try again.",
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
          message="We could not load your counter. Check your connection and try again."
          onRetry={() => void refetch()}
          title="Counter unavailable"
        />
      </Screen>
    );
  }

  const { lowStock, openOrders, outOfStock, store, today } = data;

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
              {store.name}
            </Text>
            <Text className="font-sans text-label text-text-secondary">
              {store.storeType}
              {store.area ? ` · ${store.area}` : ""}
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

        {/* The switch a shopkeeper reaches for most: shut the counter without
            calling anyone. Being LISTED at all stays with the admin. */}
        <View className="mx-gutter mt-4 flex-row items-center gap-3 rounded-card bg-surface px-4 py-3">
          <Ionicons
            color={(store.isOpen ? primary : secondary) as string}
            name={store.isOpen ? "storefront" : "storefront-outline"}
            size={22}
          />
          <View className="flex-1">
            <Text className="font-label text-body text-foreground">
              {store.isOpen ? "Taking orders" : "Closed"}
            </Text>
            <Text className="font-sans text-caption text-text-muted">
              {store.isOpen
                ? "Customers can order from you right now."
                : "You still appear in the app, greyed out."}
            </Text>
          </View>
          <Switch
            accessibilityLabel="Taking orders"
            disabled={setOpen.isPending}
            onValueChange={(value) => void setOpen.mutateAsync(value).catch(() => undefined)}
            value={store.isOpen}
          />
        </View>

        {/* Today's two numbers, side by side. Nothing else competes with them. */}
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

        <View className="pt-7">
          <SectionHeader
            subtitle={openOrders.length === 0 ? undefined : "Oldest first is the queue order"}
            title={`Waiting on you (${openOrders.length})`}
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
                          {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                          {order.contactName}
                        </Text>
                      </View>
                      <Text
                        className="font-title text-price text-foreground"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {formatPrice(order.total)}
                      </Text>
                    </View>

                    {/* Repeated here as well as for the rider: the shop packs a
                        cash order knowing money is owed at the door. */}
                    {cash ? (
                      <View className="flex-row items-center gap-2">
                        <Ionicons color={warning as string} name="cash-outline" size={14} />
                        <Text className="font-label text-caption text-warning">
                          Cash on delivery — rider collects {formatPrice(order.codAmountDue ?? order.total)}
                        </Text>
                      </View>
                    ) : null}

                    <View className="gap-1">
                      {order.items.slice(0, 4).map((item) => (
                        <Text
                          className="font-sans text-label text-text-secondary"
                          key={item._id}
                          numberOfLines={1}
                        >
                          {item.quantity} × {item.name}
                        </Text>
                      ))}
                      {order.items.length > 4 ? (
                        <Text className="font-sans text-caption text-text-muted">
                          +{order.items.length - 4} more
                        </Text>
                      ) : null}
                    </View>

                    {next ? (
                      <Pressable
                        accessibilityLabel={`${next.label}, order ${order.reference}`}
                        accessibilityRole="button"
                        className="h-11 items-center justify-center rounded-input bg-primary active:opacity-90"
                        disabled={advance.isPending}
                        onPress={() => void act(order._id, next.status)}
                      >
                        <Text className="font-heading text-body text-primary-foreground">
                          {next.label}
                        </Text>
                      </Pressable>
                    ) : (
                      <View className="h-11 items-center justify-center rounded-input bg-muted">
                        <Text className="font-label text-label text-text-secondary">
                          {order.status === "ready"
                            ? "Waiting for a rider"
                            : "With the rider"}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {lowStock.length > 0 || outOfStock > 0 ? (
          <View className="pt-7">
            <SectionHeader
              actionLabel="Open shelf"
              onAction={() => router.push("/store-inventory")}
              subtitle={outOfStock > 0 ? `${outOfStock} already out of stock` : undefined}
              title="Running low"
            />

            <View className="gap-2 px-gutter">
              {lowStock.map((product) => (
                <View
                  className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3"
                  key={product._id}
                >
                  <Ionicons color={error as string} name="alert-circle-outline" size={18} />
                  <Text className="flex-1 font-label text-label text-foreground" numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text
                    className="font-title text-label text-error"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {product.stock} left
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
