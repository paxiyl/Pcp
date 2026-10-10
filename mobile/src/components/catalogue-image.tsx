import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Text, View } from "react-native";

import { useImagePreset } from "@/features/catalogue/use-image-presets";

type Props = {
  /** A real photograph of this item, if the owner uploaded one. */
  imageUrl?: string;
  /** The preset tile key the owner chose instead. */
  imagePreset?: string;
  /** Falls back to the item's own initial when there is neither. */
  name?: string;
  /** Scales the glyph. The tile itself always fills its parent. */
  size?: number;
  contentFit?: "contain" | "cover";
  dimmed?: boolean;
};

/** Enough of the tile for the glyph to read without crowding the edges. */
const GLYPH_RATIO = 0.42;

/**
 * A catalogue item's picture, in the order of what we actually have.
 *
 * A photograph when there is one; the owner's chosen preset tile when there is
 * not; a tinted initial when there is neither. The point of the middle case is
 * that a new shop can list fifty products in an evening without photographing
 * any of them and still have a shelf that looks deliberate — the grid used to
 * render as a row of empty grey squares, which reads as broken rather than as
 * "no photo yet".
 */
export function CatalogueImage({
  imageUrl,
  imagePreset,
  name,
  size = 120,
  contentFit = "contain",
  dimmed = false,
}: Props) {
  const preset = useImagePreset(imagePreset);
  const opacity = dimmed ? 0.4 : 1;

  if (imageUrl) {
    return (
      <Image
        accessibilityIgnoresInvertColors
        alt=""
        contentFit={contentFit}
        source={{ uri: imageUrl }}
        style={{ height: "100%", opacity, width: "100%" }}
        transition={180}
      />
    );
  }

  if (preset) {
    return (
      <LinearGradient
        colors={preset.colors}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{ alignItems: "center", height: "100%", justifyContent: "center", opacity, width: "100%" }}
      >
        <Text
          // Emoji rather than an icon font: it draws the same here, in the
          // backoffice and anywhere else, with nothing to keep in step.
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ fontSize: Math.round(size * GLYPH_RATIO) }}
        >
          {preset.glyph}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      className="h-full w-full items-center justify-center bg-muted"
      style={{ opacity }}
    >
      <Text
        className="font-title text-muted-foreground"
        style={{ fontSize: Math.round(size * GLYPH_RATIO) }}
      >
        {(name ?? "?").trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}
