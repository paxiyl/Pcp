import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { BasketBar } from "@/components/basket-bar";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/product-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  findProductLine,
  useAddBasketProduct,
  useBasket,
  useSetBasketItemQuantity,
} from "@/features/basket/use-basket";
import { useProductCategories, useProducts } from "@/features/catalogue/use-stores";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

type Sort = "popular" | "price-asc" | "price-desc" | "discount" | "rating";

const SORTS: [Sort, string][] = [
  ["popular", "Popular"],
  ["discount", "Biggest saving"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["rating", "Top rated"],
];

/**
 * A category's shelf.
 *
 * `slug` of "all" is a real route, not a special case bolted on: it is how
 * "See all" from a home rail lands somewhere sensible without needing a second
 * screen that does the same job.
 */
export default function CategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { slug, sort: initialSort } = useLocalSearchParams<{ slug: string; sort?: Sort }>();

  const [sort, setSort] = useState<Sort>(initialSort ?? "popular");
  const [sortOpen, setSortOpen] = useState(false);
  const [sub, setSub] = useState<string>("all");

  const [foreground] = useCSSVariable(["--color-foreground"]);

  const everything = slug === "all";
  const categories = useProductCategories();

  const category = useMemo(
    () => (categories.data ?? []).find((item) => item.slug === slug),
    [categories.data, slug],
  );

  /** Children of this category, so a parent page can narrow without a new route. */
  const children = useMemo(
    () =>
      category
        ? (categories.data ?? []).filter((item) => item.parentId === category._id)
        : [],
    [categories.data, category],
  );

  const { data, isError, isLoading, refetch } = useProducts({
    category: everything ? undefined : sub === "all" ? slug : sub,
    limit: 40,
    sort,
  });

  const { data: basketData } = useBasket();
  const addProduct = useAddBasketProduct();
  const setQuantity = useSetBasketItemQuantity();
  const items = basketData?.basket?.items ?? [];

  const products = data?.products ?? [];
  const cardWidth = (width - 40 - 12) / 2;

  const change = async (productId: string, next: number) => {
    const line = findProductLine(items, productId);

    try {
      if (!line) {
        await addProduct.mutateAsync({ productId, quantity: 1 });
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

  const title = everything ? "All products" : (category?.name ?? "Category");

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
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
          {title}
        </Text>
        <Pressable
          accessibilityLabel="Search"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          hitSlop={8}
          onPress={() => router.push("/search")}
        >
          <Ionicons color={foreground as string} name="search" size={21} />
        </Pressable>
      </View>

      {/* Sub-categories, where the tree has them. */}
      {children.length > 0 ? (
        <ScrollView
          className="max-h-12"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {[["all", "All"] as const, ...children.map((c) => [c.slug, c.name] as const)].map(
            ([value, label]) => {
              const selected = sub === value;

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
                  onPress={() => setSub(value)}
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
            },
          )}
        </ScrollView>
      ) : null}

      {/* Result count and sort on one line: the count makes the sort worth using. */}
      <View className="flex-row items-center justify-between px-gutter py-3">
        <Text className="font-sans text-label text-text-secondary">
          {isLoading ? "Loading…" : `${data?.total ?? 0} products`}
        </Text>

        <Pressable
          accessibilityHint="Changes how these products are ordered"
          accessibilityLabel={`Sort by ${SORTS.find(([v]) => v === sort)?.[1]}`}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 active:bg-muted"
          onPress={() => setSortOpen((open) => !open)}
        >
          <Ionicons color={foreground as string} name="swap-vertical" size={14} />
          <Text className="font-label text-label text-foreground">
            {SORTS.find(([v]) => v === sort)?.[1]}
          </Text>
        </Pressable>
      </View>

      {sortOpen ? (
        <View className="mx-gutter mb-3 overflow-hidden rounded-card border border-border bg-surface">
          {SORTS.map(([value, label], index) => (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === value }}
              className={`flex-row items-center justify-between px-4 py-3 active:bg-muted ${
                index > 0 ? "border-t border-border" : ""
              }`}
              key={value}
              onPress={() => {
                setSort(value);
                setSortOpen(false);
              }}
            >
              <Text
                className={`text-body ${
                  sort === value ? "font-heading text-primary" : "font-sans text-foreground"
                }`}
              >
                {label}
              </Text>
              {sort === value ? (
                <Ionicons color={foreground as string} name="checkmark" size={17} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ProductGridSkeleton />
        ) : isError ? (
          <ErrorState
            message="We could not load this category. Check your connection and try again."
            onRetry={() => void refetch()}
            title="Category unavailable"
          />
        ) : products.length === 0 ? (
          <EmptyState
            actionLabel={sub === "all" ? "Browse everything" : "Show all in this category"}
            icon="cube-outline"
            message={
              sub === "all"
                ? "No shop near you stocks this category yet. Try browsing everything instead."
                : "Nothing in this sub-category right now."
            }
            onAction={() =>
              sub === "all"
                ? router.replace({ params: { slug: "all" }, pathname: "/category/[slug]" })
                : setSub("all")
            }
            title="Nothing here yet"
          />
        ) : (
          <View className="flex-row flex-wrap px-gutter" style={{ columnGap: 12, rowGap: 20 }}>
            {products.map((product) => {
              const quantity = findProductLine(items, product._id)?.quantity ?? 0;

              return (
                <ProductCard
                  key={product._id}
                  onAdd={() => void change(product._id, quantity + 1)}
                  onPress={() =>
                    router.push({ params: { id: product._id }, pathname: "/product/[id]" })
                  }
                  onRemove={() => void change(product._id, quantity - 1)}
                  product={product}
                  variantCount={product.variantCount}
                  quantity={quantity}
                  width={cardWidth}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      <BasketBar />
    </View>
  );
}
