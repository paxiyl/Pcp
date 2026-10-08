import { View } from "react-native";

/** Five placeholder steps, matching OrderProgress so the row does not jump. */
export function OrderProgressSkeleton() {
  return (
    <View className="flex-row px-2">
      {[0, 1, 2, 3, 4].map((key) => (
        <View className="flex-1 items-center gap-2" key={key}>
          <View className="h-8 w-8 rounded-pill bg-muted" />
          <View className="h-3 w-14 rounded-input bg-muted" />
          <View className="h-3 w-10 rounded-input bg-muted" />
        </View>
      ))}
    </View>
  );
}

/**
 * Mirrors the order detail layout — status, steps, restaurant, items, totals —
 * so the screen holds its shape while the order loads.
 */
export function OrderDetailSkeleton() {
  return (
    <View>
      <View className="items-center gap-2">
        <View className="h-4 w-24 rounded-input bg-muted" />
        <View className="mb-6 h-5 w-32 rounded-input bg-muted" />
      </View>

      <OrderProgressSkeleton />

      <View className="mx-5 mt-6 flex-row items-center gap-3 rounded-card border border-border bg-card p-3">
        <View className="rounded-input bg-muted" style={{ height: 52, width: 52 }} />
        <View className="flex-1 gap-2">
          <View className="h-4 w-40 rounded-input bg-muted" />
          <View className="h-3 w-24 rounded-input bg-muted" />
        </View>
        <View className="h-11 w-11 rounded-pill bg-muted" />
      </View>

      <View className="mx-5 mb-2 mt-6 h-5 w-20 rounded-input bg-muted" />

      <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
        {[0, 1].map((key) => (
          <View
            className={`flex-row items-center gap-3 p-3 ${key > 0 ? "border-t border-border" : ""}`}
            key={key}
          >
            <View className="flex-1 gap-2">
              <View className="h-4 w-44 rounded-input bg-muted" />
              <View className="h-3 w-32 rounded-input bg-muted" />
            </View>
            <View className="h-4 w-14 rounded-input bg-muted" />
          </View>
        ))}

        <View className="gap-3 border-t border-border p-4">
          {[0, 1, 2].map((key) => (
            <View className="flex-row items-center justify-between" key={key}>
              <View className="h-3 w-24 rounded-input bg-muted" />
              <View className="h-3 w-12 rounded-input bg-muted" />
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between border-t border-border p-4">
          <View className="h-5 w-16 rounded-input bg-muted" />
          <View className="h-6 w-20 rounded-input bg-muted" />
        </View>
      </View>

      <View className="mx-5 mt-4 overflow-hidden rounded-card border border-border bg-card">
        {[0, 1, 2, 3].map((key) => (
          <View
            className={`flex-row items-center gap-3 p-4 ${key > 0 ? "border-t border-border" : ""}`}
            key={key}
          >
            <View className="h-5 w-5 rounded-input bg-muted" />
            <View className="h-4 flex-1 rounded-input bg-muted" />
          </View>
        ))}
      </View>
    </View>
  );
}
