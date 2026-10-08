import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { PushPrimer } from "@/components/push-primer";
import { useOrder } from "@/features/orders/use-orders";
import { shouldAskForPush } from "@/features/settings/notifications";
import { formatPrice } from "@/lib/format";

/** "Arriving by 18:40" — the estimate the order was placed with. */
const formatArrival = (iso: string): string => {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) return "shortly";

  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function OrderConfirmedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [primary, warning] = useCSSVariable(["--color-primary", "--color-warning"]);

  const { data: order, isLoading } = useOrder(id ?? "");
  const [primerOpen, setPrimerOpen] = useState(false);

  /**
   * The one moment worth asking about notifications: an order has just been
   * placed, so "we will tell you when it arrives" is a concrete offer rather
   * than an abstract permission request. Asked once, ever.
   *
   * Delayed a beat so the confirmation lands first — a sheet sliding over the
   * tick would read as an interruption of the thing they just did.
   */
  useEffect(() => {
    if (!order) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void shouldAskForPush().then((ask) => {
        if (ask && !cancelled) setPrimerOpen(true);
      });
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order]);

  if (isLoading || !order) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator color={primary as string} size="large" />
      </View>
    );
  }

  // Payment can still be settling; the copy says so rather than over-promising.
  const settled = order.status !== "pending_payment";
  const cashDue = order.paymentMethod === "cod";

  return (
    <View
      className="flex-1 items-center justify-center gap-3 bg-card px-8"
      style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top }}
    >
      <View className="mb-3 h-32 w-32 items-center justify-center rounded-pill bg-secondary">
        <Ionicons color={primary as string} name="checkmark" size={64} />
      </View>

      <Text
        accessibilityRole="header"
        className="text-center font-title text-display text-foreground"
      >
        {settled ? "Order confirmed" : "Payment received"}
      </Text>

      <Text className="font-sans text-section text-muted-foreground">#{order.reference}</Text>

      <Text className="font-sans text-body text-muted-foreground">
        {settled
          ? `Arriving by ${formatArrival(order.estimatedDeliveryAt)}`
          : "We are confirming your order"}
      </Text>

      {/* Said here as well as on the tracking screen: this is the screen someone
          closes the app on, and the amount is what they need to find before the
          rider arrives. */}
      {cashDue ? (
        <View className="mt-4 w-full flex-row items-center gap-3 rounded-card bg-warning-soft p-3.5">
          <Ionicons color={warning as string} name="cash-outline" size={22} />
          <View className="flex-1">
            <Text className="font-heading text-label text-warning">
              Keep {formatPrice(order.codAmountDue ?? order.total)} ready
            </Text>
            <Text className="font-sans text-caption text-text-secondary">
              Pay the rider in cash at your door.
            </Text>
          </View>
        </View>
      ) : null}

      <View className="h-6" />

      <Pressable
        accessibilityRole="button"
        className="h-14 w-full items-center justify-center rounded-input bg-primary active:bg-primary-pressed"
        onPress={() => router.replace("/orders")}
      >
        <Text className="font-heading text-body text-primary-foreground">Track order</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        className="h-14 w-full items-center justify-center rounded-input border border-primary bg-card active:bg-secondary"
        onPress={() => router.replace("/home")}
      >
        <Text className="font-heading text-body text-primary">Back to home</Text>
      </Pressable>
      <PushPrimer onClose={() => setPrimerOpen(false)} open={primerOpen} />
    </View>
  );
}
