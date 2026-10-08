import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Restaurant } from "@/lib/api";
import { formatDeliveryFee, formatPrepTime } from "@/lib/format";

type Props = {
  restaurant: Restaurant;
  width?: number;
};

export function RestaurantCard({ restaurant, width }: Props) {
  const [rating] = useCSSVariable(["--color-rating"]);

  return (
    <Link
      asChild
      href={{
        // The id and already-loaded image let the detail hero paint instantly.
        params: { id: restaurant._id, image: restaurant.imageUrl, slug: restaurant.slug },
        pathname: "/restaurant/[slug]",
      }}
    >

        <Pressable
          accessibilityLabel={`${restaurant.name}, ${restaurant.rating} stars, ${formatPrepTime(
            restaurant.prepTimeMinMinutes,
            restaurant.prepTimeMaxMinutes,
          )}`}
          accessibilityRole="button"
          className="overflow-hidden rounded-card border border-border bg-card active:opacity-90"
          style={width ? { width } : undefined}
        >
          <View className="h-32 items-center justify-center bg-secondary">
            {restaurant.imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                alt=""
                contentFit="cover"
                source={{ uri: restaurant.imageUrl }}
                style={{ height: "100%", width: "100%" }}
                transition={200}
              />
            ) : (
              // Photography arrives with the catalogue; the initial holds the space.
              <Text className="font-title text-display text-secondary-foreground">
                {restaurant.name.charAt(0)}
              </Text>
            )}
            <View className="absolute right-3 top-3 rounded-pill bg-card px-3 py-1">
              <Text className="font-label text-caption text-card-foreground">
                {formatPrepTime(restaurant.prepTimeMinMinutes, restaurant.prepTimeMaxMinutes)}
              </Text>
            </View>
            {!restaurant.isOpen ? (
              <View className="absolute bottom-3 left-3 rounded-pill bg-foreground/80 px-3 py-1">
                <Text className="font-label text-caption text-white">Closed</Text>
              </View>
            ) : null}
          </View>

          <View className="gap-1 p-4">
            <Text className="font-heading text-section text-card-foreground" numberOfLines={1}>
              {restaurant.name}
            </Text>
            <Text className="font-sans text-label text-muted-foreground" numberOfLines={1}>
              {restaurant.cuisines.join(" • ")}
            </Text>
            <View className="mt-1 flex-row items-center gap-1">
              <Ionicons color={rating as string} name="star" size={14} />
              <Text className="font-label text-label text-card-foreground">{restaurant.rating}</Text>
              <Text className="font-sans text-label text-muted-foreground" numberOfLines={1}>
                ({restaurant.ratingCount}) · {formatDeliveryFee(restaurant.deliveryFee)}
              </Text>
            </View>
          </View>
        </Pressable>
    </Link>
  );
}
