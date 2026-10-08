import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Store } from "@/lib/api";
import { formatEta, formatPrice } from "@/lib/format";

import { PressableScale } from "./ui/pressable-scale";

type Props = {
  store: Store;
  onPress: () => void;
  /** "row" for a vertical list, "tile" for a horizontal rail. */
  variant?: "row" | "tile";
  width?: number;
};

/**
 * A shop, as a compact row rather than a product-style card.
 *
 * Deliberately not image-led. A store is chosen on name, how fast it can get
 * here and what it costs — a large photograph of a shopfront tells a customer
 * nothing and pushes three real decisions below the fold.
 */
export function StoreCard({ store, onPress, variant = "row", width }: Props) {
  const [rating, delivery, secondary] = useCSSVariable([
    "--color-rating",
    "--color-delivery",
    "--color-text-secondary",
  ]);

  const logo = (size: number) => (
    <View
      className="items-center justify-center overflow-hidden rounded-card bg-muted"
      style={{ height: size, width: size }}
    >
      {store.imageUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          alt=""
          contentFit="cover"
          source={{ uri: store.imageUrl }}
          style={{ height: "100%", opacity: store.isOpen ? 1 : 0.45, width: "100%" }}
          transition={180}
        />
      ) : (
        <Text className="font-title text-section text-text-secondary">
          {store.name.charAt(0)}
        </Text>
      )}

      {!store.isOpen ? (
        <View className="absolute inset-x-0 bottom-0 bg-foreground/75 py-0.5">
          <Text className="text-center font-label text-micro text-white">Closed</Text>
        </View>
      ) : null}
    </View>
  );

  const label = `${store.name}, ${store.storeType}, ${formatEta(store.etaMinutes)}${
    store.isOpen ? "" : ", currently closed"
  }`;

  if (variant === "tile") {
    return (
      <PressableScale
        accessibilityLabel={label}
        accessibilityRole="button"
        className="gap-2"
        onPress={onPress}
        style={width ? { width } : undefined}
        weight="card"
      >
        {logo(width ?? 112)}
        <Text className="font-label text-label text-foreground" numberOfLines={1}>
          {store.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <Ionicons color={delivery as string} name="flash" size={10} />
          <Text className="font-label text-caption text-delivery">
            {formatEta(store.etaMinutes)}
          </Text>
        </View>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      className="flex-row items-center gap-3"
      onPress={onPress}
      weight="card"
    >
      {logo(64)}

      <View className="flex-1 gap-0.5">
        <Text className="font-label text-body text-foreground" numberOfLines={1}>
          {store.name}
        </Text>
        <Text className="font-sans text-caption text-text-muted" numberOfLines={1}>
          {store.storeType}
          {store.area ? ` · ${store.area}` : ""}
        </Text>

        <View className="mt-0.5 flex-row items-center gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons color={rating as string} name="star" size={10} />
            <Text className="font-label text-caption text-foreground">{store.rating}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons color={delivery as string} name="flash" size={10} />
            <Text className="font-label text-caption text-delivery">
              {formatEta(store.etaMinutes)}
            </Text>
          </View>
          <Text className="font-sans text-caption text-text-muted">
            {store.deliveryFee === 0 ? "Free delivery" : `${formatPrice(store.deliveryFee)} fee`}
          </Text>
        </View>
      </View>

      <Ionicons color={secondary as string} name="chevron-forward" size={16} />
    </PressableScale>
  );
}
