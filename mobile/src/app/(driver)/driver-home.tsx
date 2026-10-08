import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { DriverHomeSkeleton } from "@/components/driver-home-skeleton";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";
import { useDriverHome, useSetOnline } from "@/features/driver/use-driver";
import type { Delivery } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const DeliveryCard = ({
  actionColor,
  delivery,
  onOpen,
  primaryLabel,
}: {
  actionColor: string;
  delivery: Delivery;
  onOpen: () => void;
  primaryLabel: string;
}) => {
  const [subtle] = useCSSVariable(["--color-subtle-foreground"]);
  const { order, payout } = delivery;
  const imageUrl = order.items.find((item) => item.imageUrl)?.imageUrl || order.restaurantImageUrl;

  return (
    <Pressable
      accessibilityLabel={`${order.restaurantName}, ${formatPrice(payout.total)}, ${primaryLabel}`}
      accessibilityRole="button"
      className="mb-3 flex-row gap-3 rounded-card border border-border bg-card p-3 active:bg-muted"
      onPress={onOpen}
    >
      {imageUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          alt=""
          contentFit="cover"
          source={{ uri: imageUrl }}
          style={{ borderRadius: 12, height: 84, width: 84 }}
          transition={200}
        />
      ) : (
        <View
          className="items-center justify-center rounded-input bg-muted"
          style={{ height: 84, width: 84 }}
        >
          <Ionicons color={subtle as string} name="restaurant-outline" size={24} />
        </View>
      )}

      <View className="flex-1">
        <Text className="font-heading text-body text-foreground">{order.restaurantName}</Text>

        <View className="mt-1 flex-row items-center gap-1">
          <Ionicons color={subtle as string} name="location-outline" size={14} />
          <Text className="font-sans text-label text-muted-foreground">
            {payout.distanceKm > 0 ? `${payout.distanceKm.toFixed(1)} km away` : "Distance unknown"}
          </Text>
        </View>

        <Text className="font-sans text-label text-muted-foreground">
          Drop-off {order.deliveryAddress.city}
        </Text>

        <View className="mt-1 flex-row items-end justify-between">
          <Text className="font-heading text-section text-foreground">
            {formatPrice(payout.total)}
          </Text>

          {/* Same colour language as the delivery screen: claim, carry, complete. */}
          <View className="rounded-input px-4 py-2" style={{ backgroundColor: actionColor }}>
            <Text className="font-heading text-label text-white">{primaryLabel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

/**
 * The rider queue. Claiming happens on the delivery screen rather than here, so
 * nobody takes a job before seeing where it goes and what it pays.
 */
export default function DriverHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [headerFrom, headerTo, headerInk, subtle, primary, warning, success] = useCSSVariable([
    "--color-header-from",
    "--color-header-to",
    "--color-header-foreground",
    "--color-subtle-foreground",
    "--color-primary",
    "--color-warning",
    "--color-success",
  ]);

  const { data: user } = useCurrentUser();
  const { data, isLoading, isRefetching, refetch } = useDriverHome();
  const setOnline = useSetOnline();
  const logout = useLogout();

  const summary = data?.summary;
  const online = summary?.isOnline ?? false;

  const openDelivery = (id: string) =>
    router.push({ params: { id }, pathname: "/(driver)/delivery/[id]" });

  return (
    <View className="flex-1 bg-background">
      <LinearGradient
        colors={[headerFrom as string, headerTo as string]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{ paddingTop: insets.top }}
      >
        <View className="px-5 pb-10 pt-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-body" style={{ color: headerInk as string }}>
              {online ? "Online" : "Offline"}
            </Text>

            <View className="flex-row items-center gap-2">
              <Switch
                accessibilityLabel="Go online to receive deliveries"
                disabled={setOnline.isPending}
                ios_backgroundColor="rgba(255,255,255,0.35)"
                onValueChange={(value) =>
                  setOnline.mutate(value, {
                    onError: (error) =>
                      toast.error("Could not change your status", { description: error.message }),
                  })
                }
                thumbColor="#ffffff"
                trackColor={{ false: "rgba(255,255,255,0.35)", true: "rgba(255,255,255,0.55)" }}
                value={online}
              />

              <Pressable
                accessibilityLabel="Sign out"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center active:opacity-80"
                hitSlop={8}
                onPress={() => logout.mutate()}
              >
                <Ionicons color={headerInk as string} name="log-out-outline" size={22} />
              </Pressable>
            </View>
          </View>

          <Text
            accessibilityRole="header"
            className="mt-3 font-title text-display"
            style={{ color: headerInk as string }}
          >
            {user?.name ?? "Driver"}
          </Text>

          <Text
            className="mt-1 font-heading text-body"
            style={{ color: headerInk as string, opacity: 0.85 }}
          >
            {summary
              ? `${summary.deliveries} ${summary.deliveries === 1 ? "delivery" : "deliveries"} · ${formatPrice(summary.earnings)} today`
              : "Loading today's run"}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        className="-mt-6 rounded-t-sheet bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 20 }}
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
        {isLoading ? (
          <DriverHomeSkeleton />
        ) : (
          <>
            {data && data.active.length > 0 ? (
              <>
                <Text className="mx-5 mb-3 font-heading text-section text-foreground">
                  Your delivery
                </Text>
                <View className="px-5">
                  {data.active.map((delivery) => (
                    <DeliveryCard
                      actionColor={
                        delivery.order.status === "ready"
                          ? (warning as string)
                          : (success as string)
                      }
                      delivery={delivery}
                      key={delivery.order._id}
                      onOpen={() => openDelivery(delivery.order._id)}
                      primaryLabel={delivery.order.status === "ready" ? "Pick up" : "Deliver"}
                    />
                  ))}
                </View>
              </>
            ) : null}

            <Text className="mx-5 mb-3 mt-2 font-heading text-section text-foreground">
              Ready orders
            </Text>

            {data && data.ready.length > 0 ? (
              <View className="px-5">
                {data.ready.map((delivery) => (
                  <DeliveryCard
                    actionColor={primary as string}
                    delivery={delivery}
                    key={delivery.order._id}
                    onOpen={() => openDelivery(delivery.order._id)}
                    primaryLabel="Claim"
                  />
                ))}
              </View>
            ) : (
              <View className="mx-5 items-center gap-2 rounded-card bg-muted p-8">
                <Ionicons color={subtle as string} name="bicycle-outline" size={36} />
                <Text className="text-center font-heading text-body text-foreground">
                  No orders ready yet
                </Text>
                <Text className="text-center font-sans text-label text-muted-foreground">
                  {online
                    ? "New deliveries appear here the moment a kitchen finishes one."
                    : "Go online to start receiving deliveries."}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
