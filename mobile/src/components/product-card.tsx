import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Product } from "@/lib/api";
import { formatDiscount, formatPrice } from "@/lib/format";

import { CatalogueImage } from "./catalogue-image";

import { PressableScale } from "./ui/pressable-scale";
import { QuantityStepper } from "./ui/quantity-stepper";

type Props = {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  onPress: () => void;
  /** Rails pass a fixed width; grids leave it off and let flex decide. */
  width?: number;
  /** Rails hide the ETA to stay compact; the grid shows it. */
  showEta?: boolean;
  etaMinutes?: number;
  /** Siblings in this article's variant group, when the caller knows. */
  variantCount?: number;
};

/**
 * The product card. The single most-repeated component in the app, so it is
 * built for density first: at 150px wide, four of these fit a 360px screen with
 * room for the gutter.
 *
 * Hierarchy, in the order the eye should land:
 *   1. the photograph        — the only thing with real size
 *   2. the price             — title weight, largest text in the card
 *   3. the Add control       — green, the only saturated element in the lower half
 *   4. name, then pack size  — read only once the first three have done their job
 *
 * There is no border and no shadow. The image tile's warm fill separates the
 * card from the canvas, which keeps a scrolling grid from turning into a wall of
 * outlined boxes.
 */
function ProductCardComponent({
  product,
  quantity,
  onAdd,
  onRemove,
  onPress,
  width,
  showEta = false,
  etaMinutes,
  variantCount,
}: Props) {
  const [rating, delivery] = useCSSVariable(["--color-rating", "--color-delivery"]);

  const discount = formatDiscount(product.mrp, product.price);
  const soldOut = !product.isAvailable || product.stock === 0;
  // Schedule H medicine is never addable from a grid: the API refuses it, so
  // offering an Add button here would only produce an error the customer did
  // nothing to deserve. The card routes to the detail screen to explain instead.
  const prescriptionOnly = product.requiresPrescription;

  return (
    <View className="gap-2" style={width ? { width } : undefined}>
      <PressableScale
        accessibilityHint="Opens the product"
        accessibilityLabel={`${product.name}, ${product.unit}, ${formatPrice(product.price)}${
          discount ? `, ${discount}` : ""
        }${soldOut ? ", out of stock" : ""}`}
        accessibilityRole="button"
        className="aspect-square w-full overflow-hidden rounded-tile bg-muted"
        onPress={onPress}
        weight="card"
      >
        <CatalogueImage
          dimmed={soldOut}
          imagePreset={product.imagePreset}
          imageUrl={product.imageUrl}
          name={product.name}
          size={width ?? 150}
        />

        {/* The discount flag sits on the image, not under it: on a shelf of
            twenty products the saving has to be findable without reading. */}
        {discount && !soldOut ? (
          <View className="absolute left-0 top-2 rounded-r-chip bg-offer px-2 py-1">
            <Text
              className="font-title text-micro uppercase text-offer-foreground"
              style={{ letterSpacing: 0.4 }}
            >
              {discount}
            </Text>
          </View>
        ) : null}

        {prescriptionOnly ? (
          <View className="absolute inset-x-0 bottom-0 bg-info/85 py-1.5">
            <Text className="text-center font-label text-caption text-white">
              Prescription needed
            </Text>
          </View>
        ) : soldOut ? (
          <View className="absolute inset-x-0 bottom-0 bg-foreground/75 py-1.5">
            <Text className="text-center font-label text-caption text-white">Out of stock</Text>
          </View>
        ) : showEta && etaMinutes ? (
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1 rounded-pill bg-delivery-soft px-2 py-0.5">
            <Ionicons color={delivery as string} name="flash" size={10} />
            <Text className="font-label text-micro text-delivery">{etaMinutes} min</Text>
          </View>
        ) : null}
      </PressableScale>

      {/* Fixed two-line box. Without it, a one-line name and a two-line name
          leave their Add buttons on different baselines across the grid. */}
      <View style={{ minHeight: 36 }}>
        <Text className="font-label text-label text-foreground" numberOfLines={2}>
          {product.name}
        </Text>
      </View>

      <View className="flex-row items-center gap-1.5">
        <Text className="font-sans text-caption text-text-muted">
          {variantCount && product.variantType
            ? `${variantCount} ${product.variantType.toLowerCase()}s`
            : product.unit}
        </Text>
        {product.rating ? (
          <>
            <Text className="font-sans text-caption text-text-muted">·</Text>
            <Ionicons color={rating as string} name="star" size={9} />
            <Text className="font-label text-caption text-text-secondary">{product.rating}</Text>
          </>
        ) : null}
      </View>

      <View className="flex-row items-end justify-between gap-2">
        <View className="shrink">
          <Text
            className="font-title text-price text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(product.price)}
          </Text>
          {product.mrp > product.price ? (
            <Text
              className="font-sans text-caption text-text-muted line-through"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(product.mrp)}
            </Text>
          ) : null}
        </View>

        {prescriptionOnly ? (
          <PressableScale
            accessibilityHint="Opens the product to explain why"
            accessibilityLabel={`${product.name}, prescription required`}
            accessibilityRole="button"
            className="h-8 min-w-20 items-center justify-center rounded-chip border border-border bg-surface px-3"
            onPress={onPress}
          >
            <Text className="font-heading text-label text-text-secondary">View</Text>
          </PressableScale>
        ) : (
          <QuantityStepper
            disabled={soldOut}
            label={product.name}
            max={product.maxPerOrder ?? product.stock}
            onAdd={onAdd}
            onRemove={onRemove}
            quantity={quantity}
            size="sm"
          />
        )}
      </View>
    </View>
  );
}

/**
 * Memoised on the values that actually change. A grid re-renders on every basket
 * mutation, and without this each keystroke in search would rebuild every card.
 */
export const ProductCard = memo(
  ProductCardComponent,
  (prev, next) =>
    prev.product._id === next.product._id &&
    prev.product.price === next.product.price &&
    prev.product.stock === next.product.stock &&
    prev.product.isAvailable === next.product.isAvailable &&
    prev.product.requiresPrescription === next.product.requiresPrescription &&
    prev.variantCount === next.variantCount &&
    prev.quantity === next.quantity &&
    prev.width === next.width,
);
