import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { DeliveryCodeCard } from "@/components/delivery-code-card";
import { OrderDetailSkeleton } from "@/components/order-detail-skeleton";
import { OrderProgress } from "@/components/order-progress";
import { useOrder, useReorder } from "@/features/orders/use-orders";
import type { OrderStatus } from "@/lib/api";
import { BRAND } from "@/lib/brand";
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

const TRACKABLE: OrderStatus[] = ["confirmed", "preparing", "ready", "out_for_delivery"];

export default function OrderDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [primary, subtle, border, foreground] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-border",
    "--color-foreground",
  ]);

  const { data: order, isLoading } = useOrder(id ?? "");
  const reorder = useReorder();

  const close = () => (router.canGoBack() ? router.back() : router.replace("/orders"));

  const header = (
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
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-title text-title text-foreground"
      >
        Order details
      </Text>
      <View className="h-11 w-11" />
    </View>
  );

  if (isLoading || !order) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <OrderDetailSkeleton />
      </View>
    );
  }

  const trackable = TRACKABLE.includes(order.status);

  const handleReorder = () =>
    reorder.mutate(order._id, {
      onError: (error) => toast.error("We could not reorder that", { description: error.message }),
      onSuccess: (response) => {
        if (response.data.skipped.length > 0) {
          toast("Some dishes were unavailable", {
            description: response.data.skipped.join(", "),
          });
        }

        router.push("/basket");
      },
    });

  const addressLine = [
    order.deliveryAddress.line1,
    order.deliveryAddress.line2,
    order.deliveryAddress.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-center font-sans text-body text-muted-foreground">
          {order.reference}
        </Text>
        <Text className="mb-6 mt-1 text-center font-heading text-section text-primary">
          {STATUS_LABELS[order.status]}
        </Text>

        <OrderProgress order={order} />

        {/* The rider asks for this at the door; it is pointless once handed over. */}
        {order.deliveryCode && trackable ? (
          <View className="mt-6 px-5">
            <DeliveryCodeCard code={order.deliveryCode} />
          </View>
        ) : null}

        {/* Restaurant */}
        <View className="mx-5 mt-6 flex-row items-center gap-3 rounded-card border border-border bg-card p-3">
          {order.restaurantImageUrl ? (
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={{ uri: order.restaurantImageUrl }}
              style={{ borderRadius: 12, height: 52, width: 52 }}
              transition={200}
            />
          ) : (
            <View
              className="items-center justify-center rounded-input bg-muted"
              style={{ height: 52, width: 52 }}
            >
              <Ionicons color={subtle as string} name="restaurant-outline" size={20} />
            </View>
          )}

          <View className="flex-1">
            <Text className="font-heading text-body text-foreground">{order.restaurantName}</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => router.push("/home")}
            >
              <Text className="font-heading text-label text-primary">View menu</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Call the restaurant"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-pill border border-border active:bg-muted"
            onPress={() =>
              toast("No number for this restaurant yet", {
                description: "Restaurant phone numbers arrive with the admin app.",
              })
            }
          >
            <Ionicons color={subtle as string} name="call-outline" size={18} />
          </Pressable>
        </View>

        {/* Items and money */}
        <Text className="mx-5 mb-2 mt-6 font-heading text-section text-foreground">Items</Text>

        <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
          {order.items.map((item, index) => (
            <View
              className={`flex-row items-center gap-3 p-3 ${index > 0 ? "border-t border-border" : ""}`}
              key={item._id}
            >
              <View className="flex-1">
                <Text className="font-heading text-body text-foreground">{item.name}</Text>
                {item.optionNames.length > 0 ? (
                  <Text className="font-sans text-label text-muted-foreground">
                    {item.optionNames.join(", ")}
                  </Text>
                ) : null}
                {item.note ? (
                  <Text className="font-sans text-caption text-muted-foreground">{item.note}</Text>
                ) : null}
              </View>

              <Text className="w-8 text-center font-sans text-body text-muted-foreground">
                {item.quantity}
              </Text>
              <Text className="font-heading text-body text-foreground">
                {formatPrice(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}

          <View className="gap-2 border-t border-border p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted-foreground">Subtotal</Text>
              <Text className="font-sans text-body text-foreground">
                {formatPrice(order.subtotal)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted-foreground">Delivery fee</Text>
              <Text className="font-sans text-body text-foreground">
                {order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted-foreground">Service fee</Text>
              <Text className="font-sans text-body text-foreground">
                {formatPrice(order.serviceFee)}
              </Text>
            </View>
          </View>

          <View
            className="flex-row items-center justify-between border-t p-4"
            style={{ borderColor: border as string }}
          >
            <Text className="font-heading text-section text-foreground">Total</Text>
            <Text className="font-title text-title text-foreground">
              {formatPrice(order.total)}
            </Text>
          </View>
        </View>

        {/* Payment, address and help */}
        <View className="mx-5 mt-4 overflow-hidden rounded-card border border-border bg-card">
          <View className="flex-row items-center gap-3 p-4">
            <Ionicons color={subtle as string} name="card-outline" size={20} />
            <Text className="flex-1 font-heading text-label text-foreground">Payment method</Text>
            <Text className="font-sans text-body text-muted-foreground">Card</Text>
          </View>

          <View className="flex-row items-center gap-3 border-t border-border p-4">
            <Ionicons color={subtle as string} name="location-outline" size={20} />
            <Text className="font-heading text-label text-foreground">Delivery address</Text>
            <Text className="flex-1 text-right font-sans text-body text-muted-foreground">
              {addressLine}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-border p-4 active:bg-muted"
            onPress={() =>
              toast("Receipts arrive with email delivery", {
                description: `Order ${order.reference} · ${formatPrice(order.total)}`,
              })
            }
          >
            <Ionicons color={subtle as string} name="document-text-outline" size={20} />
            <Text className="flex-1 font-heading text-label text-foreground">View receipt</Text>
            <Ionicons color={subtle as string} name="chevron-forward" size={18} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-border p-4 active:bg-muted"
            onPress={() => void Linking.openURL(`mailto:${BRAND.supportEmail}`)}
          >
            <Ionicons color={subtle as string} name="help-circle-outline" size={20} />
            <Text className="flex-1 font-heading text-label text-foreground">Get help</Text>
            <Ionicons color={subtle as string} name="chevron-forward" size={18} />
          </Pressable>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-border bg-background px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          accessibilityRole="button"
          className="h-13 flex-1 items-center justify-center rounded-input border border-primary bg-card active:bg-secondary"
          disabled={reorder.isPending}
          onPress={handleReorder}
        >
          {reorder.isPending ? (
            <ActivityIndicator color={primary as string} />
          ) : (
            <Text className="font-heading text-body text-primary">Reorder</Text>
          )}
        </Pressable>

        {trackable ? (
          <Pressable
            accessibilityRole="button"
            className="h-13 flex-1 items-center justify-center rounded-input bg-primary active:bg-primary-pressed"
            onPress={() => router.push({ params: { id: order._id }, pathname: "/track/[id]" })}
          >
            <Text className="font-heading text-body text-primary-foreground">Track order</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
