import { Text, View } from "react-native";

import { BRAND } from "@/lib/brand";

type Props = {
  /** "brand" renders green for light surfaces, "inverse" renders white over media. */
  tone?: "brand" | "inverse";
  size?: "hero" | "title" | "compact";
  /** Shows "(Hindaun)" under the name. On for first-run and auth, off in chrome. */
  showCity?: boolean;
};

const nameSize = {
  compact: "text-title",
  hero: "text-hero",
  title: "text-display",
} as const;

/**
 * The Raket lockup: "Raket" in text colour, "Delivery" in the brand green, so
 * the mark reads as one word while still carrying the brand colour. Set in the
 * title weight with tight tracking — no logo image, so it stays sharp at every
 * size and follows the theme without a second asset.
 */
export function Wordmark({ tone = "brand", size = "title", showCity = false }: Props) {
  const inverse = tone === "inverse";

  return (
    <View className="gap-0.5">
      <Text
        accessibilityLabel={BRAND.fullName}
        accessibilityRole="header"
        className={`font-title ${nameSize[size]} ${inverse ? "text-white" : "text-foreground"}`}
        style={{ letterSpacing: -0.6 }}
      >
        Raket
        <Text className={inverse ? "text-white" : "text-primary"}>Delivery</Text>
      </Text>

      {showCity ? (
        <Text
          className={`font-label text-label uppercase ${
            inverse ? "text-white/80" : "text-text-secondary"
          }`}
          style={{ letterSpacing: 1.4 }}
        >
          {BRAND.city}
        </Text>
      ) : null}
    </View>
  );
}
