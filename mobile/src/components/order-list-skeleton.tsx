import { View } from "react-native";

const Thumbnail = () => <View className="rounded-input bg-muted" style={{ height: 64, width: 64 }} />;

/**
 * Mirrors the Orders layout — an active card above a grouped past list — so the
 * screen keeps its shape while loading instead of collapsing to a spinner.
 */
export function OrderListSkeleton() {
  return (
    <View className="pt-4">
      <View className="mx-5 mb-2 h-5 w-32 rounded-input bg-muted" />

      <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
        <View className="flex-row items-center gap-3 p-3">
          <Thumbnail />
          <View className="flex-1 gap-2">
            <View className="h-4 w-40 rounded-input bg-muted" />
            <View className="h-3 w-20 rounded-input bg-muted" />
            <View className="h-3 w-24 rounded-input bg-muted" />
          </View>
          <View className="items-end gap-2">
            <View className="h-3 w-16 rounded-input bg-muted" />
            <View className="h-4 w-14 rounded-input bg-muted" />
          </View>
        </View>
        <View className="items-end border-t border-border p-3">
          <View className="h-4 w-24 rounded-input bg-muted" />
        </View>
      </View>

      <View className="mx-5 mb-2 mt-6 h-5 w-28 rounded-input bg-muted" />

      <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
        {[0, 1, 2].map((key) => (
          <View
            className={`flex-row items-center gap-3 p-3 ${key > 0 ? "border-t border-border" : ""}`}
            key={key}
          >
            <Thumbnail />
            <View className="flex-1 gap-2">
              <View className="h-4 w-36 rounded-input bg-muted" />
              <View className="h-3 w-28 rounded-input bg-muted" />
              <View className="h-3 w-16 rounded-input bg-muted" />
            </View>
            <View className="items-end gap-3">
              <View className="h-4 w-14 rounded-input bg-muted" />
              <View className="h-3 w-16 rounded-input bg-muted" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
