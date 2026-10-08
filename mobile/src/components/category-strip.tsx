import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { useCategories } from "@/features/catalogue/use-categories";
import type { Category } from "@/lib/api";

type Props = {
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

const CIRCLE = 50;
/** Gap between the filled circle and the selection ring. */
const RING_GAP = 3;
const RING_WIDTH = 2;
const OUTER = CIRCLE + (RING_GAP + RING_WIDTH) * 2;

/** Skeleton circles keep the strip's height stable while the catalogue loads. */
function CategorySkeleton() {
  return (
    <View className="flex-row gap-3 px-5">
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <View className="items-center gap-2" key={key} style={{ width: OUTER }}>
          <View className="rounded-pill bg-muted" style={{ height: OUTER, width: OUTER }} />
          <View className="h-3 w-11 rounded-pill bg-muted" />
        </View>
      ))}
    </View>
  );
}

function CategoryItem({
  backgroundColor,
  children,
  label,
  onPress,
  ringColor,
  selected,
}: {
  backgroundColor: string;
  children: ReactNode;
  label: string;
  onPress: () => void;
  ringColor: string;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="items-center gap-2 active:opacity-80"
      onPress={onPress}
      style={{ width: OUTER }}
    >
      {/* Outer ring sits a few points clear of the circle, so the gap reads as white. */}
      <View
        className="items-center justify-center rounded-pill"
        style={{
          borderColor: selected ? ringColor : "transparent",
          borderWidth: RING_WIDTH,
          height: OUTER,
          padding: RING_GAP,
          width: OUTER,
        }}
      >
        <View
          className="items-center justify-center overflow-hidden rounded-pill"
          style={{ backgroundColor, height: CIRCLE, width: CIRCLE }}
        >
          <View className="-mr-0.5">{children}</View>
        </View>
      </View>
      <Text
        className={`text-caption ${
          selected ? "font-heading text-primary" : "font-label text-foreground"
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CategoryStrip({ onSelect, selectedSlug }: Props) {
  const { data: categories, isLoading } = useCategories();
  const [primary, muted, subtle] = useCSSVariable([
    "--color-primary",
    "--color-muted",
    "--color-subtle-foreground",
  ]);

  if (isLoading) return <CategorySkeleton />;

  const allSelected = selectedSlug === "all";

  
  const renderImage = (category: Category) => {
    return  category.imageUrl ? (
      <Image
        accessibilityIgnoresInvertColors
        alt=""
        contentFit="cover"
        contentPosition="right"
        source={{ uri: category.imageUrl }}
        style={{ height: CIRCLE -5, width: CIRCLE -5 }}
        transition={200}
  onError={(e) => console.log("IMAGE ERROR", e.error)}
  onLoad={() => console.log("IMAGE LOADED")}
      />
    ) : (
      <Ionicons color={subtle as string} name="restaurant-outline" size={20} />
    );
  }
   

  return (
    <ScrollView
      contentContainerClassName="gap-3 px-5"
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      <CategoryItem
        backgroundColor={allSelected ? (primary as string) : (muted as string)}
        label="All"
        onPress={() => onSelect("all")}
        ringColor={primary as string}
        selected={allSelected}
      >
        <Ionicons
          color={allSelected ? "#ffffff" : (subtle as string)}
          name="grid-outline"
          size={20}
        />
      </CategoryItem>

      {categories?.map((category) => (
        <CategoryItem
          backgroundColor={category.backgroundColor}
          key={category._id}
          label={category.name}
          onPress={() => onSelect(category.slug)}
          ringColor={primary as string}
          selected={selectedSlug === category.slug}
        >
          {renderImage(category)}
        </CategoryItem>
      ))}
    </ScrollView>
  );
}
