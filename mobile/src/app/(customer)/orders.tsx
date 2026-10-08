import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { OrderListSkeleton } from "@/components/order-list-skeleton";
import { Screen } from "@/components/ui/screen";
import { useOrders, useReorder } from "@/features/orders/use-orders";
import type { Order, OrderStatus } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const STATUS_LABELS: Record<OrderStatus, string> = {
  cancelled: "Cancelled",
  confirmed: "Confirmed",
  delivered: "Delivered",
  out_for_delivery: "On the way",
  payment_failed: "Payment failed",
  pending_payment: "Awaiting payment",
  preparing: "Preparing",
  ready: "Ready for collection",
};

/** Anything still on its way to the customer belongs in the active section. */
const ACTIVE_STATUSES: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery"];

const statusTone = (status: OrderStatus): string => {
  if (status === "cancelled" || status === "payment_failed") return "text-error";

  return "text-success";
};

/** "Today • 1:15 PM", "Yesterday • 7:45 PM", then "May 12 • 1:20 PM". */
const formatPlaced = (iso: string): string => {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) return "";

  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const dayDifference = Math.floor((startOfToday.getTime() - at.getTime()) / 86_400_000);

  if (at.getTime() >= startOfToday.getTime()) return `Today • ${time}`;
  if (dayDifference < 1) return `Yesterday • ${time}`;

  return `${at.toLocaleDateString([], { day: "numeric", month: "short" })} • ${time}`;
};

/**
 * Minutes left until the estimate, shown as a window the same width as the
 * restaurant's own prep range so it reads like the rest of the app.
 */
const formatEta = (order: Order): string => {
  const minutes = Math.ceil((new Date(order.estimatedDeliveryAt).getTime() - Date.now()) / 60_000);

  if (Number.isNaN(minutes) || minutes <= 1) return "Arriving soon";

  const spread = Math.max(order.prepTimeMaxMinutes - order.prepTimeMinMinutes, 1);

  return `${Math.max(minutes - spread, 1)}–${minutes} min`;
};

/** Shows the food that was ordered, falling back to the restaurant's own photo. */
const OrderThumbnail = ({ order }: { order: Order }) => {
  const [subtle] = useCSSVariable(["--color-subtle-foreground"]);

  const imageUrl =
    order.items.find((item) => item.imageUrl)?.imageUrl || order.restaurantImageUrl;

  if (imageUrl) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        alt=""
        contentFit="cover"
        source={{ uri: imageUrl }}
        style={{ borderRadius: 12, height: 64, width: 64 }}
        transition={200}
      />
    );
  }

  return (
    <View
      className="items-center justify-center rounded-input bg-muted"
      style={{ height: 64, width: 64 }}
    >
      <Ionicons color={subtle as string} name="restaurant-outline" size={22} />
    </View>
  );
};

/** The live order: the card opens its details, "Track order" opens the map. */
const ActiveOrderCard = ({ order }: { order: Order }) => {
  const router = useRouter();
  const [primary] = useCSSVariable(["--color-primary"]);

  return (
    <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
      <Pressable
        accessibilityLabel={`Order ${order.reference} from ${order.restaurantName}`}
        accessibilityRole="button"
        className="flex-row items-center gap-3 p-3 active:bg-muted"
        onPress={() => router.push({ params: { id: order._id }, pathname: "/order/[id]" })}
      >
        <OrderThumbnail order={order} />

        <View className="flex-1">
          <Text className="font-heading text-body text-foreground">{order.restaurantName}</Text>
          <Text className="font-sans text-label text-muted-foreground">{order.reference}</Text>
          <Text className={`mt-1 font-heading text-label ${statusTone(order.status)}`}>
            {STATUS_LABELS[order.status]}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text className="font-sans text-label text-muted-foreground">{formatEta(order)}</Text>
          <Text className="font-heading text-body text-foreground">
            {formatPrice(order.total)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        accessibilityLabel="Track order"
        accessibilityRole="button"
        className="flex-row items-center justify-end gap-1 border-t border-border px-3 py-3 active:bg-muted"
        onPress={() => router.push({ params: { id: order._id }, pathname: "/track/[id]" })}
      >
        <Text className="font-heading text-label text-primary">Track order</Text>
        <Ionicons color={primary as string} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
};

const PastOrderRow = ({
  first,
  onReorder,
  order,
  reordering,
}: {
  first: boolean;
  onReorder: (order: Order) => void;
  order: Order;
  reordering: boolean;
}) => {
  const router = useRouter();
  const [primary] = useCSSVariable(["--color-primary"]);

  return (
    <View className={first ? "" : "border-t border-border"}>
      <Pressable
        accessibilityLabel={`Order ${order.reference} from ${order.restaurantName}`}
        accessibilityRole="button"
        className="flex-row items-center gap-3 p-3 active:bg-muted"
        onPress={() => router.push({ params: { id: order._id }, pathname: "/order/[id]" })}
      >
        <OrderThumbnail order={order} />

        <View className="flex-1">
          <Text className="font-heading text-body text-foreground">{order.restaurantName}</Text>
          <Text className="font-sans text-label text-muted-foreground">
            {formatPlaced(order.createdAt)}
          </Text>
          <Text className={`mt-1 font-heading text-label ${statusTone(order.status)}`}>
            {STATUS_LABELS[order.status]}
          </Text>
        </View>

        <View className="items-end justify-between gap-3">
          <Text className="font-heading text-body text-foreground">
            {formatPrice(order.total)}
          </Text>

          <Pressable
            accessibilityLabel={`Reorder from ${order.restaurantName}`}
            accessibilityRole="button"
            className="flex-row items-center gap-1"
            disabled={reordering}
            hitSlop={8}
            onPress={() => onReorder(order)}
          >
            {reordering ? (
              <ActivityIndicator color={primary as string} size="small" />
            ) : (
              <>
                <Text className="font-heading text-label text-primary">Reorder</Text>
                <Ionicons color={primary as string} name="chevron-forward" size={16} />
              </>
            )}
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
};

export default function OrdersScreen() {
  const router = useRouter();
  const [primary, subtle] = useCSSVariable(["--color-primary", "--color-subtle-foreground"]);
  const { data: orders, isLoading, isRefetching, refetch } = useOrders();
  const reorder = useReorder();

  const [pendingId, setPendingId] = useState<string | null>(null);

  // An unpaid order was never placed, so it does not belong in the history.
  const placed = (orders ?? []).filter((order) => order.status !== "pending_payment");
  const active = placed.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const past = placed.filter((order) => !ACTIVE_STATUSES.includes(order.status));

  const handleReorder = (order: Order) => {
    if (pendingId) return;

    setPendingId(order._id);

    reorder.mutate(order._id, {
      onError: (error) =>
        toast.error("We could not reorder that", {
          description: error.message,
        }),
      onSettled: () => setPendingId(null),
      onSuccess: (response) => {
        const { skipped } = response.data;

        if (skipped.length > 0) {
          toast("Some dishes were unavailable", { description: skipped.join(", ") });
        }

        router.push("/basket");
      },
    });
  };

  const header = (
    <View className="px-5 pt-4">
      <Text accessibilityRole="header" className="font-title text-title text-foreground">
        Orders
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <Screen edges={["top"]}>
        {header}
        <OrderListSkeleton />
      </Screen>
    );
  }

  if (placed.length === 0) {
    return (
      <Screen edges={["top"]}>
        {header}
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Ionicons color={subtle as string} name="receipt-outline" size={44} />
          <Text className="text-center font-heading text-section text-foreground">
            No orders yet
          </Text>
          <Text className="text-center font-sans text-body text-muted-foreground">
            When you place an order, you can follow it here from the kitchen to your door.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-2 h-13 items-center justify-center rounded-input bg-primary px-6 active:bg-primary-pressed"
            onPress={() => router.replace("/home")}
          >
            <Text className="font-heading text-body text-primary-foreground">
              Discover restaurants
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}
        refreshControl={
          <RefreshControl
            colors={[primary as string]}
            onRefresh={() => void refetch()}
            refreshing={isRefetching}
            tintColor={primary as string}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {active.length > 0 ? (
          <>
            <Text className="mx-5 mb-2 font-heading text-section text-foreground">
              {active.length === 1 ? "Active order" : "Active orders"}
            </Text>
            {active.map((order) => (
              <View className="mb-3" key={order._id}>
                <ActiveOrderCard order={order} />
              </View>
            ))}
          </>
        ) : null}

        {past.length > 0 ? (
          <>
            <Text className="mx-5 mb-2 mt-3 font-heading text-section text-foreground">
              Past orders
            </Text>

            <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
              {past.map((order, index) => (
                <PastOrderRow
                  first={index === 0}
                  key={order._id}
                  onReorder={handleReorder}
                  order={order}
                  reordering={pendingId === order._id}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Closes the list rather than leaving it to stop mid-air. */}
        <View className="mx-5 mt-4 flex-row items-center gap-3 rounded-card bg-muted p-4">
          <Ionicons color={subtle as string} name="receipt-outline" size={32} />
          <View className="flex-1">
            <Text className="font-heading text-body text-foreground">No more orders yet</Text>
            <Text className="font-sans text-label text-muted-foreground">
              Discover great restaurants to order from.
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-2 flex-row items-center gap-1"
              hitSlop={8}
              onPress={() => router.replace("/home")}
            >
              <Text className="font-heading text-label text-primary">Discover restaurants</Text>
              <Ionicons color={primary as string} name="chevron-forward" size={16} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
