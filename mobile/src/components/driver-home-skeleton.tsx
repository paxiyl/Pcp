import { View } from "react-native";

/** Mirrors the rider queue so the sheet keeps its shape while it loads. */
export function DriverHomeSkeleton() {
  return (
    <View>
      <View className="mx-5 mb-3 h-5 w-32 rounded-input bg-muted" />

      <View className="px-5">
        {[0, 1].map((key) => (
          <View
            className="mb-3 flex-row gap-3 rounded-card border border-border bg-card p-3"
            key={key}
          >
            <View className="rounded-input bg-muted" style={{ height: 84, width: 84 }} />
            <View className="flex-1 gap-2">
              <View className="h-4 w-44 rounded-input bg-muted" />
              <View className="h-3 w-24 rounded-input bg-muted" />
              <View className="h-3 w-32 rounded-input bg-muted" />
              <View className="mt-1 flex-row items-center justify-between">
                <View className="h-5 w-16 rounded-input bg-muted" />
                <View className="h-8 w-20 rounded-input bg-muted" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
