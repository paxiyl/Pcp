import { View } from "react-native";

import { OrderProgressSkeleton } from "./order-detail-skeleton";

/**
 * Mirrors the tracking layout — headline, arrival, steps, map, courier — so the
 * map area does not appear to pop in once the order arrives.
 */
export function OrderTrackingSkeleton({ bottomInset }: { bottomInset: number }) {
  return (
    <View className="flex-1">
      <View className="items-center gap-2">
        <View className="h-6 w-52 rounded-input bg-muted" />
        <View className="h-4 w-24 rounded-input bg-muted" />
      </View>

      <View className="mt-5 items-center gap-2">
        <View className="h-4 w-20 rounded-input bg-muted" />
        <View className="mb-5 h-8 w-44 rounded-input bg-muted" />
      </View>

      <OrderProgressSkeleton />

      <View className="mt-5 flex-1 bg-muted" />

      <View className="gap-3 px-5 pt-3" style={{ paddingBottom: bottomInset + 12 }}>
        <View className="flex-row items-center gap-3 rounded-card border border-border bg-card p-3">
          <View className="rounded-pill bg-muted" style={{ height: 52, width: 52 }} />
          <View className="flex-1 gap-2">
            <View className="h-4 w-32 rounded-input bg-muted" />
            <View className="h-3 w-24 rounded-input bg-muted" />
          </View>
          <View className="h-11 w-11 rounded-pill bg-muted" />
          <View className="h-11 w-11 rounded-pill bg-muted" />
        </View>

        <View className="flex-row items-center rounded-card border border-border bg-card p-4">
          <View className="h-4 flex-1 rounded-input bg-muted" />
        </View>
      </View>
    </View>
  );
}
