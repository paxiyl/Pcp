import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBasket } from "@/features/basket/use-basket";
import { formatPrice } from "@/lib/format";

type Props = {
  /**
   * The vendor whose page is being viewed. A basket belongs to one vendor, so
   * the bar only appears on that vendor's page: showing another shop's basket
   * here would offer a total that has nothing to do with what is on screen.
   *
   * Omit on screens that are not a vendor page (Home, Search) to always show it.
   */
  vendorId?: string;
};

/**
 * Floating basket bar. Only appears once something is in the basket, so it never
 * sits there as an empty control.
 */
export function BasketBar({ vendorId }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data } = useBasket();

  const count = data?.totals.itemCount ?? 0;
  const basket = data?.basket;
  const currentVendorId = basket?.vendorKind === "store" ? basket.storeId : basket?.restaurantId;
  const belongsHere = !vendorId || currentVendorId === vendorId;

  if (count === 0 || !belongsHere) return null;

  return (
    <View
      className="absolute left-0 right-0 px-5"
      pointerEvents="box-none"
      style={{ bottom: insets.bottom + 12 }}
    >
      <Pressable
        accessibilityLabel={`View basket, ${count} ${count === 1 ? "item" : "items"}, ${formatPrice(
          data?.totals.subtotal ?? 0,
        )}`}
        accessibilityRole="button"
        className="h-14 flex-row items-center justify-between rounded-input bg-primary px-4 active:bg-primary-pressed"
        onPress={() => router.push("/basket")}
        style={{
          elevation: 6,
          shadowColor: "#102a2a",
          shadowOffset: { height: 4, width: 0 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        }}
      >
        <View className="flex-row items-center gap-3">
          <View>
            <Ionicons color="#ffffff" name="basket-outline" size={24} />
            <View className="absolute -right-2 -top-1 h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1">
              <Text className="font-heading text-caption text-white">{count}</Text>
            </View>
          </View>
          <Text className="font-heading text-body text-primary-foreground">
            {count} {count === 1 ? "item" : "items"}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <Text className="font-heading text-body text-primary-foreground">
            View basket · {formatPrice(data?.totals.subtotal ?? 0)}
          </Text>
          <Ionicons color="#ffffff" name="chevron-forward" size={18} />
        </View>
      </Pressable>
    </View>
  );
}
