import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";
import {
  findProductLine,
  useAddBasketProduct,
  useBasket,
  useSetBasketItemQuantity,
} from "@/features/basket/use-basket";
import { useProduct } from "@/features/catalogue/use-stores";
import { formatDiscount, formatEta, formatPrice, formatSavings } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

/**
 * One product. Short on purpose: for a packaged SKU the decision is price, pack
 * size and whether it is in stock, and burying those under a long description
 * is how a two-tap purchase becomes a five-tap one.
 */
export default function ProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [foreground, rating, delivery, offer, info] = useCSSVariable([
    "--color-foreground",
    "--color-rating",
    "--color-delivery",
    "--color-offer",
    "--color-info",
  ]);

  const { data, isLoading, isError, refetch } = useProduct(id ?? "");
  const { data: basketData } = useBasket();
  const addProduct = useAddBasketProduct();
  const setQuantity = useSetBasketItemQuantity();

  const product = data?.product;
  const store = data?.store;
  const variants = data?.variants ?? [];
  const items = basketData?.basket?.items ?? [];
  const line = product ? findProductLine(items, product._id) : undefined;
  const quantity = line?.quantity ?? 0;

  const change = async (next: number) => {
    if (!product) return;

    try {
      if (!line) {
        await addProduct.mutateAsync({ productId: product._id, quantity: 1 });
        haptics.selection();

        return;
      }

      await setQuantity.mutateAsync({ itemId: line._id, quantity: next });
    } catch (error) {
      toast.error("Could not update your basket", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const header = (
    <View className="flex-row items-center px-gutter py-3">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        className="-ml-2 h-11 w-11 items-center justify-center"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
      >
        <Ionicons color={foreground as string} name="arrow-back" size={24} />
      </Pressable>
      <View className="flex-1" />
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <Skeleton className="mx-gutter aspect-square rounded-tile" />
        <View className="gap-3 px-gutter pt-5">
          <SkeletonLine height={18} width="78%" />
          <SkeletonLine height={12} width="34%" />
          <SkeletonLine height={24} width={110} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <ErrorState
          message="We could not load this product. It may have been removed."
          onRetry={() => void refetch()}
          title="Product unavailable"
        />
      </View>
    );
  }

  const discount = formatDiscount(product.mrp, product.price);
  const savings = formatSavings(product.mrp, product.price);
  const soldOut = !product.isAvailable || product.stock === 0;
  // Surfaced only when it is genuinely low. "12 left" on a shelf of 80 is noise.
  const lowStock = !soldOut && product.stock <= 5;
  const prescriptionOnly = product.requiresPrescription;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mx-gutter aspect-square overflow-hidden rounded-tile bg-muted">
          <Image
            accessibilityIgnoresInvertColors
            alt=""
            contentFit="contain"
            source={{ uri: product.imageUrl }}
            style={{ height: "100%", opacity: soldOut ? 0.4 : 1, width: "100%" }}
            transition={200}
          />
          {discount && !soldOut ? (
            <View className="absolute left-0 top-4 rounded-r-chip bg-offer px-3 py-1.5">
              <Text className="font-title text-label uppercase text-offer-foreground">
                {discount}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-gutter pt-5">
          {product.brand ? (
            <Text className="font-label text-label uppercase text-text-muted" style={{ letterSpacing: 1 }}>
              {product.brand}
            </Text>
          ) : null}

          <Text className="mt-1 font-title text-title text-foreground">{product.name}</Text>
          <Text className="mt-1 font-sans text-body text-text-secondary">{product.unit}</Text>

          <View className="mt-4 flex-row items-end gap-2.5">
            <Text
              className="font-title text-price-lg text-foreground"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {formatPrice(product.price)}
            </Text>
            {product.mrp > product.price ? (
              <Text
                className="pb-0.5 font-sans text-body text-text-muted line-through"
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {formatPrice(product.mrp)}
              </Text>
            ) : null}
          </View>

          {savings ? (
            <Text className="mt-1 font-label text-label text-success">{savings}</Text>
          ) : null}

          {variants.length > 1 ? (
            <View className="mt-5">
              <Text className="font-heading text-label text-foreground">
                {product.variantType ?? "Options"}
              </Text>

              <View className="mt-2 flex-row flex-wrap gap-2">
                {variants.map((variant) => {
                  const selected = variant._id === product._id;
                  const gone = !variant.isAvailable || variant.stock === 0;

                  return (
                    <Pressable
                      accessibilityLabel={`${variant.variantLabel ?? variant.unit}${
                        gone ? ", out of stock" : ""
                      }`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: gone, selected }}
                      className={`h-10 min-w-14 items-center justify-center rounded-input border px-3 ${
                        selected
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-surface active:bg-muted"
                      } ${gone ? "opacity-45" : ""}`}
                      disabled={gone || selected}
                      key={variant._id}
                      // Replace rather than push: walking back through six sizes
                      // of the same shirt is not a history anyone wants.
                      onPress={() =>
                        router.replace({
                          params: { id: variant._id },
                          pathname: "/product/[id]",
                        })
                      }
                    >
                      <Text
                        className={`text-label ${
                          selected ? "font-heading text-primary" : "font-label text-foreground"
                        } ${gone ? "line-through" : ""}`}
                      >
                        {variant.variantLabel ?? variant.unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View className="mt-4 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            {product.rating ? (
              <View className="flex-row items-center gap-1">
                <Ionicons color={rating as string} name="star" size={13} />
                <Text className="font-label text-label text-foreground">{product.rating}</Text>
                <Text className="font-sans text-caption text-text-muted">
                  ({product.ratingCount})
                </Text>
              </View>
            ) : null}

            {store ? (
              <View className="flex-row items-center gap-1">
                <Ionicons color={delivery as string} name="flash" size={13} />
                <Text className="font-label text-label text-delivery">
                  {formatEta(store.etaMinutes)}
                </Text>
              </View>
            ) : null}
          </View>

          {prescriptionOnly ? (
            <View className="mt-5 gap-1.5 rounded-card bg-info-soft p-3.5">
              <View className="flex-row items-center gap-2">
                <Ionicons color={info as string} name="document-text-outline" size={16} />
                <Text className="font-heading text-label text-info">Prescription required</Text>
              </View>
              <Text className="font-sans text-label text-text-secondary">
                This medicine can only be dispensed against a valid prescription. Please take
                yours to {store?.name ?? "the pharmacy"} to collect it.
              </Text>
            </View>
          ) : lowStock ? (
            <View className="mt-4 flex-row items-center gap-2 rounded-input bg-offer-soft px-3 py-2">
              <Ionicons color={offer as string} name="alert-circle-outline" size={15} />
              <Text className="font-label text-label text-offer">
                Only {product.stock} left at this shop
              </Text>
            </View>
          ) : null}

          {store ? (
            <Pressable
              accessibilityLabel={`Open ${store.name}`}
              accessibilityRole="link"
              className="mt-5 flex-row items-center gap-3 rounded-card border border-border bg-surface p-3 active:bg-muted"
              onPress={() => router.push({ params: { slug: store.slug }, pathname: "/store/[slug]" })}
            >
              <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-input bg-muted">
                {store.imageUrl ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    alt=""
                    contentFit="cover"
                    source={{ uri: store.imageUrl }}
                    style={{ height: "100%", width: "100%" }}
                  />
                ) : (
                  <Text className="font-title text-body text-text-secondary">
                    {store.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="font-label text-label text-foreground">{store.name}</Text>
                <Text className="font-sans text-caption text-text-muted">
                  {store.area ? `${store.area} · ` : ""}See everything from this shop
                </Text>
              </View>
              <Ionicons color={foreground as string} name="chevron-forward" size={16} />
            </Pressable>
          ) : null}

          {product.description ? (
            <View className="mt-6">
              <Text className="font-heading text-section text-foreground">Details</Text>
              <Text className="mt-2 font-sans text-body text-text-secondary">
                {product.description}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* The buy control is pinned, not scrolled past. On a phone the decision is
          made from the image and the price, both of which are above it. */}
      <View
        className="absolute inset-x-0 bottom-0 flex-row items-center justify-between gap-4 border-t border-border bg-background px-gutter pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View>
          <Text className="font-sans text-caption text-text-muted">{product.unit}</Text>
          <Text
            className="font-title text-price-lg text-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {formatPrice(product.price)}
          </Text>
        </View>

        <View style={{ minWidth: 132 }}>
          {prescriptionOnly ? (
            <View className="h-10 items-center justify-center rounded-chip border border-border bg-muted px-4">
              <Text className="font-heading text-label text-text-secondary">In-store only</Text>
            </View>
          ) : (
          <QuantityStepper
            disabled={soldOut}
            label={product.name}
            max={Math.min(product.maxPerOrder, product.stock)}
            onAdd={() => void change(quantity + 1)}
            onRemove={() => void change(quantity - 1)}
            quantity={quantity}
          />
          )}
        </View>
      </View>
    </View>
  );
}
