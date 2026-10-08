import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { DeliveryCodeCard } from "@/components/delivery-code-card";
import { OrderProgress } from "@/components/order-progress";
import { OrderTrackingSkeleton } from "@/components/order-tracking-skeleton";
import { OrderRouteMap } from "@/components/order-route-map";
import { useOrder } from "@/features/orders/use-orders";
import type { OrderStatus } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const HEADLINES: Partial<Record<OrderStatus, string>> = {
  cancelled: "Order cancelled",
  confirmed: "Order confirmed",
  delivered: "Order delivered",
  out_for_delivery: "Order on the way",
  payment_failed: "Payment not completed",
  pending_payment: "Waiting for payment",
  preparing: "Order being prepared",
  ready: "Order ready for pickup",
};

/**
 * A finished order has nowhere to go, so the live apparatus — the ETA counting
 * down, the map, the rider card — is wrong for it rather than merely unused.
 */
const ENDED: OrderStatus[] = ["cancelled", "payment_failed"];

export default function OrderTrackingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [primary, subtle, foreground, warning, error] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-foreground",
    "--color-warning",
    "--color-error",
  ]);

  // The rider moves while the screen is open, so keep this one fresh.
  const { data: order, isLoading } = useOrder(id ?? "", { refetchInterval: 15_000 });
  const [summaryOpen, setSummaryOpen] = useState(false);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/orders"));

  if (isLoading || !order) {
    return (
      <View className="flex-1 bg-card" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-5 py-3">
          <View className="h-11 w-11" />
        </View>
        <OrderTrackingSkeleton bottomInset={insets.bottom} />
      </View>
    );
  }

  const minutes = Math.ceil((new Date(order.estimatedDeliveryAt).getTime() - Date.now()) / 60_000);
  const spread = Math.max(order.prepTimeMaxMinutes - order.prepTimeMinMinutes, 1);
  const arrival =
    order.status === "delivered"
      ? "Delivered"
      : minutes <= 1
        ? "Any minute now"
        : `${Math.max(minutes - spread, 1)}–${minutes} min`;

  const driver = order.driver;
  const ended = ENDED.includes(order.status);
  // Cash orders are the one case where the customer still owes money at the
  // door. Burying that would be exactly the "surprise at the final step" the
  // checkout checklist warns about, one step later.
  const cashDue = order.paymentMethod === "cod" && !order.codCollectedAt;

  return (
    <View className="flex-1 bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-5 py-3">
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="-ml-2 h-11 w-11 items-center justify-center"
          hitSlop={8}
          onPress={close}
        >
          <Ionicons color={foreground as string} name="arrow-back" size={24} />
        </Pressable>
        <View className="flex-1" />
        <View className="h-11 w-11" />
      </View>

      <Text
        accessibilityRole="header"
        className="text-center font-title text-title text-foreground"
      >
        {HEADLINES[order.status] ?? "Your order"}
      </Text>
      <Text className="text-center font-sans text-body text-muted-foreground">
        {order.reference}
      </Text>

      {ended ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-error-soft">
            <Ionicons
              color={error as string}
              name={order.status === "cancelled" ? "close-circle-outline" : "card-outline"}
              size={30}
            />
          </View>

          <Text className="mt-4 text-center font-heading text-section text-foreground">
            {order.status === "cancelled"
              ? "This order was cancelled"
              : "Your payment did not go through"}
          </Text>
          <Text className="mt-1.5 max-w-xs text-center font-sans text-body text-text-secondary">
            {order.status === "cancelled"
              ? "Nothing has been charged. Anything already taken is refunded to the same account within 5 working days."
              : "No money has left your account. You can put the same items back in your basket and try again."}
          </Text>

          <Pressable
            accessibilityLabel={order.status === "cancelled" ? "Back to orders" : "Try again"}
            accessibilityRole="button"
            className="mt-6 h-13 items-center justify-center rounded-input bg-primary px-6"
            onPress={() => router.replace("/orders")}
          >
            <Text className="font-heading text-body text-primary-foreground">
              {order.status === "cancelled" ? "Back to orders" : "Back to orders"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text className="mt-5 text-center font-sans text-body text-muted-foreground">
            {order.status === "delivered" ? "Arrived" : "Arrives in"}
          </Text>
          <Text className="mb-5 text-center font-title text-display text-primary">{arrival}</Text>

          <OrderProgress order={order} />

          <View className="mt-5 flex-1">
            <OrderRouteMap order={order} />
          </View>
        </>
      )}

      <View
        className="gap-3 px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {cashDue && !ended ? (
          <View className="flex-row items-center gap-3 rounded-card bg-warning-soft p-3.5">
            <Ionicons color={warning as string} name="cash-outline" size={22} />
            <View className="flex-1">
              <Text className="font-heading text-label text-warning">
                Keep {formatPrice(order.codAmountDue ?? order.total)} ready
              </Text>
              <Text className="font-sans text-caption text-text-secondary">
                Your rider collects cash at the door. Exact change helps.
              </Text>
            </View>
          </View>
        ) : null}

        {order.deliveryCode && order.status !== "delivered" && !ended ? (
          <DeliveryCodeCard code={order.deliveryCode} />
        ) : null}

        {/* Courier */}
        {driver ? (
          <View className="flex-row items-center gap-3 rounded-card border border-border bg-card p-3">
            {driver.avatarUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                alt=""
                contentFit="cover"
                source={{ uri: driver.avatarUrl }}
                style={{ borderRadius: 26, height: 52, width: 52 }}
                transition={200}
              />
            ) : (
              <View
                className="items-center justify-center rounded-pill bg-secondary"
                style={{ height: 52, width: 52 }}
              >
                <Ionicons color={primary as string} name="person" size={22} />
              </View>
            )}

            <View className="flex-1">
              <Text className="font-heading text-body text-foreground">{driver.name}</Text>
              <Text className="font-sans text-label text-muted-foreground">Your courier</Text>
              {driver.rating !== undefined ? (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <Ionicons color="#FF8A00" name="star" size={12} />
                  <Text className="font-heading text-label text-foreground">
                    {driver.rating.toFixed(1)}
                  </Text>
                  {driver.ratingCount ? (
                    <Text className="font-sans text-label text-muted-foreground">
                      ({driver.ratingCount})
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel={`Call ${driver.name}`}
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-pill border border-border active:bg-muted"
              onPress={() =>
                toast(
                  driver.phone ? `Calling ${driver.name}` : "No number for this courier yet",
                  { description: driver.phone ?? "Rider phone numbers arrive with the driver app." },
                )
              }
            >
              <Ionicons color={subtle as string} name="call-outline" size={18} />
            </Pressable>

            <Pressable
              accessibilityLabel={`Message ${driver.name}`}
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-pill border border-border active:bg-muted"
              onPress={() =>
                toast("Courier chat is coming", {
                  description: "Messaging arrives with the driver app.",
                })
              }
            >
              <Ionicons color={subtle as string} name="chatbubble-outline" size={18} />
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-3 rounded-card border border-border bg-muted p-3">
            <View
              className="items-center justify-center rounded-pill bg-card"
              style={{ height: 52, width: 52 }}
            >
              <Ionicons color={subtle as string} name="person-outline" size={22} />
            </View>
            <View className="flex-1">
              <Text className="font-heading text-body text-foreground">
                Driver not assigned yet
              </Text>
              <Text className="font-sans text-label text-muted-foreground">
                We will show your courier here as soon as one picks up your order.
              </Text>
            </View>
          </View>
        )}

        {/* Order summary */}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: summaryOpen }}
          className="flex-row items-center rounded-card border border-border bg-card p-4 active:bg-muted"
          onPress={() => setSummaryOpen((current) => !current)}
        >
          <Text className="flex-1 font-heading text-body text-foreground">
            Order summary · {formatPrice(order.total)}
          </Text>
          <Ionicons
            color={subtle as string}
            name={summaryOpen ? "chevron-up" : "chevron-down"}
            size={18}
          />
        </Pressable>

        {summaryOpen ? (
          <ScrollView
            className="max-h-48 rounded-card border border-border bg-card"
            showsVerticalScrollIndicator={false}
          >
            {order.items.map((item, index) => (
              <View
                className={`flex-row items-center gap-3 p-3 ${index > 0 ? "border-t border-border" : ""}`}
                key={item._id}
              >
                <Text className="w-6 font-sans text-body text-muted-foreground">
                  {item.quantity}
                </Text>
                <View className="flex-1">
                  <Text className="font-heading text-body text-foreground">{item.name}</Text>
                  {item.optionNames.length > 0 ? (
                    <Text className="font-sans text-label text-muted-foreground">
                      {item.optionNames.join(", ")}
                    </Text>
                  ) : null}
                </View>
                <Text className="font-heading text-body text-foreground">
                  {formatPrice(item.unitPrice * item.quantity)}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}
