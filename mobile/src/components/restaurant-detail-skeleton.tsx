import { View } from "react-native";

const HERO_HEIGHT = 220;

/**
 * Mirrors the real layout so the screen keeps its shape while loading instead of
 * collapsing to a spinner.
 */
export function RestaurantDetailSkeleton() {
  return (
    <View className="flex-1 bg-card">
      <View className="bg-muted" style={{ height: HERO_HEIGHT }} />

      <View className="-mt-6 rounded-t-sheet bg-card px-5 pt-6">
        <View className="h-8 w-56 rounded-input bg-muted" />
        <View className="mt-3 h-4 w-40 rounded-input bg-muted" />
        <View className="mt-4 h-4 w-24 rounded-input bg-muted" />

        <View className="mt-5 flex-row gap-6 border-y border-border py-5">
          {[0, 1, 2].map((key) => (
            <View className="flex-1 gap-2" key={key}>
              <View className="h-4 w-20 rounded-input bg-muted" />
              <View className="h-3 w-16 rounded-input bg-muted" />
            </View>
          ))}
        </View>

        <View className="mt-5 h-16 rounded-card bg-muted" />

        <View className="mt-7 h-5 w-52 rounded-input bg-muted" />
        <View className="mt-4 flex-row gap-4">
          {[0, 1].map((key) => (
            <View className="h-40 w-44 rounded-card bg-muted" key={key} />
          ))}
        </View>
      </View>

      <View className="mt-7 gap-5 px-5">
        {[0, 1, 2].map((key) => (
          <View className="flex-row items-center gap-4" key={key}>
            <View className="h-18 w-18 rounded-input bg-muted" style={{ height: 72, width: 72 }} />
            <View className="flex-1 gap-2">
              <View className="h-4 w-40 rounded-input bg-muted" />
              <View className="h-3 w-56 rounded-input bg-muted" />
              <View className="h-4 w-16 rounded-input bg-muted" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
