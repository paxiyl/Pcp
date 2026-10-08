import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { BasketBar } from "@/components/basket-bar";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton, StoreListSkeleton } from "@/components/product-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { findProductLine, useAddBasketProduct, useBasket, useSetBasketItemQuantity } from "@/features/basket/use-basket";
import { useStore } from "@/features/catalogue/use-stores";
import * as haptics from "@/lib/haptics";
import { formatClosingTime, formatEta, formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

/**
 * A store's own page. Distinct from a product list: the identity, the ETA and
 * whether the shop is actually open come first, because those decide whether
 * the shelf below is worth reading at all.
 */
export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const [foreground, rating, delivery, secondary] = useCSSVariable([
    "--color-foreground",
    "--color-rating",
    "--color-delivery",
    "--color-text-secondary",
  ]);

  const { data, isLoading, isError, refetch } = useStore(slug ?? "");
  const { data: basketData } = useBasket();
  const addProduct = useAddBasketProduct();
  const setQuantity = useSetBasketItemQuantity();

  const [category, setCategory] = useState<string>("all");

  const store = data?.store;
  const products = useMemo(() => data?.products ?? [], [data]);
  const items = basketData?.basket?.items ?? [];

  /** Categories present on this shelf, not the global tree — a store page should
      never offer a filter that returns nothing. */
  const categories = useMemo(() => {
    const seen = new Map<string, string>();

    for (const product of products) {
      const c = product.categoryId;

      if (typeof c === "object" && c?.slug) seen.set(c.slug, c.name);
    }

    return [...seen.entries()];
  }, [products]);

  const visible =
    category === "all"
      ? products
      : products.filter(
          (product) =>
            typeof product.categoryId === "object" && product.categoryId?.slug === category,
        );

  // Two columns at the page gutter, matching ProductGridSkeleton.
  const cardWidth = (width - 40 - 12) / 2;

  const changeQuantity = async (productId: string, next: number) => {
    const line = findProductLine(items, productId);

    try {
      if (!line) {
        await addProduct.mutateAsync({ productId, quantity: 1 });
        haptics.selection();

        return;
      }

      await setQuantity.mutateAsync({ itemId: line._id, quantity: next });
    } catch (error) {
      // The server owns stock and the one-vendor rule, so its message is the
      // useful one here — it says what is actually wrong.
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
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-heading text-section text-foreground"
        numberOfLines={1}
      >
        {store?.name ?? "Store"}
      </Text>
      <View className="h-11 w-11" />
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <Skeleton className="mx-gutter h-36 rounded-card" />
        <View className="h-6" />
        <StoreListSkeleton count={1} />
        <View className="h-6" />
        <ProductGridSkeleton />
      </View>
    );
  }

  if (isError || !store) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <ErrorState
          message="We could not load this shop. Check your connection and try again."
          onRetry={() => void refetch()}
          title="Shop unavailable"
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Full-bleed cover. The only image on the page with real size, so the
            shop reads as a place rather than another row in a list. */}
        <View className="mx-gutter overflow-hidden rounded-card bg-muted" style={{ height: 136 }}>
          {store.coverUrl || store.imageUrl ? (
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={{ uri: store.coverUrl || store.imageUrl }}
              style={{ height: "100%", width: "100%" }}
              transition={200}
            />
          ) : null}

          {!store.isOpen ? (
            <View className="absolute inset-0 items-center justify-center bg-foreground/60">
              <Text className="font-heading text-section text-white">Closed right now</Text>
              <Text className="mt-0.5 font-sans text-label text-white/85">
                Opens again tomorrow
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-gutter pt-4">
          <Text className="font-title text-title text-foreground">{store.name}</Text>
          <Text className="mt-0.5 font-sans text-label text-text-secondary">
            {store.storeType}
            {store.area ? ` · ${store.area}` : ""}
          </Text>

          {/* The three facts that decide whether to shop here. */}
          <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-2">
            <View className="flex-row items-center gap-1">
              <Ionicons color={rating as string} name="star" size={13} />
              <Text className="font-label text-label text-foreground">{store.rating}</Text>
              <Text className="font-sans text-caption text-text-muted">
                ({store.ratingCount})
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              <Ionicons color={delivery as string} name="flash" size={13} />
              <Text className="font-label text-label text-delivery">
                {formatEta(store.etaMinutes)}
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              <Ionicons color={secondary as string} name="time-outline" size={13} />
              <Text className="font-sans text-label text-text-secondary">
                Closes {formatClosingTime(store.closesAt)}
              </Text>
            </View>
          </View>

          {/* Fees stated up front. The checkout checklist's rule: never surprise
              someone with a cost at the final step. */}
          <View className="mt-3 flex-row items-center gap-2 rounded-input bg-muted px-3 py-2">
            <Ionicons color={secondary as string} name="bicycle-outline" size={15} />
            <Text className="font-sans text-caption text-text-secondary">
              {store.deliveryFee === 0 ? "Free delivery" : `${formatPrice(store.deliveryFee)} delivery`}
              {store.freeDeliveryThreshold
                ? ` · free over ${formatPrice(store.freeDeliveryThreshold)}`
                : ""}
              {store.minOrder > 0 ? ` · ${formatPrice(store.minOrder)} minimum` : ""}
            </Text>
          </View>
        </View>

        {categories.length > 1 ? (
          <ScrollView
            className="mt-5"
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {[["all", "All"] as const, ...categories].map(([value, label]) => {
              const selected = category === value;

              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`h-9 items-center justify-center rounded-pill border px-4 ${
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-border bg-surface active:bg-muted"
                  }`}
                  key={value}
                  onPress={() => setCategory(value)}
                >
                  <Text
                    className={`text-label ${
                      selected ? "font-heading text-primary" : "font-label text-text-secondary"
                    }`}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <View className="mt-5">
          {visible.length === 0 ? (
            <EmptyState
              compact
              icon="cube-outline"
              message={
                category === "all"
                  ? "This shop has not listed anything yet. Try another nearby store."
                  : "Nothing in this category right now. Try another one."
              }
              title="Nothing on the shelf"
              {...(category !== "all"
                ? { actionLabel: "Show everything", onAction: () => setCategory("all") }
                : {})}
            />
          ) : (
            <View
              className="flex-row flex-wrap px-gutter"
              style={{ columnGap: 12, rowGap: 20 }}
            >
              {visible.map((product) => {
                const line = findProductLine(items, product._id);
                const quantity = line?.quantity ?? 0;

                return (
                  <ProductCard
                    etaMinutes={store.etaMinutes}
                    key={product._id}
                    onAdd={() => void changeQuantity(product._id, quantity + 1)}
                    onPress={() =>
                      router.push({ params: { id: product._id }, pathname: "/product/[id]" })
                    }
                    onRemove={() => void changeQuantity(product._id, quantity - 1)}
                    product={product}
                    variantCount={product.variantCount}
                    quantity={quantity}
                    showEta
                    width={cardWidth}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <BasketBar vendorId={store._id} />
    </View>
  );
}
