import { View } from "react-native";

/**
 * Mirrors the Home feed — one horizontal row of cards above a stacked list — so
 * the sheet keeps its shape while restaurants load.
 */
export function RestaurantListSkeleton({ contentWidth }: { contentWidth: number }) {
  return (
    <View>
      <View className="mb-4 mt-6 px-5">
        <View className="h-6 w-48 rounded-input bg-muted" />
      </View>

      <View className="flex-row gap-4 px-5">
        {[0, 1].map((key) => (
          <View
            className="overflow-hidden rounded-card border border-border bg-card"
            key={key}
            style={{ width: contentWidth * 0.72 }}
          >
            <View className="h-32 bg-muted" />
            <View className="gap-2 p-3">
              <View className="h-4 w-32 rounded-input bg-muted" />
              <View className="h-3 w-40 rounded-input bg-muted" />
              <View className="h-3 w-28 rounded-input bg-muted" />
            </View>
          </View>
        ))}
      </View>

      <View className="mb-4 mt-7 px-5">
        <View className="h-6 w-44 rounded-input bg-muted" />
      </View>

      <View className="gap-4 px-5">
        {[0, 1].map((key) => (
          <View
            className="overflow-hidden rounded-card border border-border bg-card"
            key={key}
          >
            <View className="h-32 bg-muted" />
            <View className="gap-2 p-3">
              <View className="h-4 w-36 rounded-input bg-muted" />
              <View className="h-3 w-44 rounded-input bg-muted" />
              <View className="h-3 w-24 rounded-input bg-muted" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
