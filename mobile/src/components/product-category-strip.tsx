import { Image } from "expo-image";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { ProductCategory } from "@/lib/api";

import { CategoryStripSkeleton } from "./product-skeletons";

type Props = {
  categories: ProductCategory[];
  isLoading: boolean;
  onSelect: (slug: string) => void;
};

const TILE = 64;

/**
 * The category strip.
 *
 * Rounded squares at 64pt, not 96pt circles. The brief's complaint about
 * oversized icons eating the screen is the real constraint here: at this size
 * five fit across a 360px phone and the first product rail stays above the fold,
 * which is the thing the strip exists to lead to.
 *
 * Categories with nothing in them are dropped — a tile that opens onto an empty
 * shelf is worse than no tile.
 */
export function ProductCategoryStrip({ categories, isLoading, onSelect }: Props) {
  if (isLoading) return <CategoryStripSkeleton />;

  const stocked = categories.filter((category) => (category.productCount ?? 0) > 0);

  if (stocked.length === 0) return null;

  return (
    <ScrollView
      contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {stocked.map((category) => (
        <Pressable
          accessibilityHint={`${category.productCount} products`}
          accessibilityLabel={category.name}
          accessibilityRole="button"
          className="items-center gap-2 active:opacity-70"
          key={category._id}
          onPress={() => onSelect(category.slug)}
          style={{ width: TILE + 8 }}
        >
          <View
            className="items-center justify-center overflow-hidden rounded-tile"
            style={{ backgroundColor: category.backgroundColor, height: TILE, width: TILE }}
          >
            {category.imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                alt=""
                contentFit="contain"
                source={{ uri: category.imageUrl }}
                style={{ height: "74%", width: "74%" }}
                transition={180}
              />
            ) : (
              // No artwork yet: the initial on the tint still reads as a category
              // rather than leaving a hole in the strip.
              <Text className="font-title text-title text-foreground" style={{ opacity: 0.55 }}>
                {category.name.charAt(0)}
              </Text>
            )}
          </View>

          <Text
            className="text-center font-label text-caption text-text-secondary"
            numberOfLines={2}
          >
            {category.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
