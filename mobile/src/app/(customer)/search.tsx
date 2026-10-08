import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useCSSVariable } from "uniwind";

import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/product-skeletons";
import { StoreCard } from "@/components/store-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { SectionHeader } from "@/components/ui/section-header";
import {
  findProductLine,
  useAddBasketProduct,
  useBasket,
  useSetBasketItemQuantity,
} from "@/features/basket/use-basket";
import {
  clearRecentSearches,
  getRecentSearches,
  POPULAR_SEARCHES,
  rememberSearch,
} from "@/features/catalogue/recent-searches";
import { useSearch } from "@/features/catalogue/use-search";
import { BRAND } from "@/lib/brand";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

type Filter = "all" | "products" | "stores" | "food";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["products", "Products"],
  ["stores", "Shops"],
  ["food", "Food"],
];

/**
 * Search.
 *
 * Before a term is typed this is a browsing surface, not a blank page: recent
 * searches then popular ones. That is the state the screen is in most often, so
 * it gets the same care as the results.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { handoff, q } = useLocalSearchParams<{ handoff?: string; q?: string }>();

  const [term, setTerm] = useState(q ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [recent, setRecent] = useState<string[]>([]);

  const [subtle, foreground] = useCSSVariable([
    "--color-text-muted",
    "--color-foreground",
  ]);

  // Search is a tab, so it keeps its last term. Arriving from the home field is a
  // fresh intent: the handoff stamp changes and the term starts over.
  useEffect(() => {
    if (handoff) {
      setTerm(q ?? "");
      setFilter("all");
    }
  }, [handoff, q]);

  useEffect(() => {
    void getRecentSearches().then(setRecent);
  }, []);

  const { data, isError, isLoading, isTyping, refetch, term: settled } = useSearch(term);

  // Remembered only once the term has settled and actually returned something.
  // Storing every keystroke would fill the list with "a", "at", "att".
  useEffect(() => {
    if (!settled || isLoading || isTyping || !data) return;

    const found = data.products.length + data.stores.length + data.restaurants.length;

    if (found > 0) void rememberSearch(settled).then(setRecent);
  }, [data, isLoading, isTyping, settled]);

  const { data: basketData } = useBasket();
  const addProduct = useAddBasketProduct();
  const setQuantity = useSetBasketItemQuantity();
  const items = basketData?.basket?.items ?? [];

  const change = useCallback(
    async (productId: string, next: number) => {
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
    },
    [addProduct, items, setQuantity],
  );

  const hasTerm = term.trim().length > 0;
  const products = data?.products ?? [];
  const stores = data?.stores ?? [];
  const restaurants = data?.restaurants ?? [];
  const total = products.length + stores.length + restaurants.length;
  const busy = isLoading || isTyping;
  const cardWidth = (width - 40 - 12) / 2;

  const showProducts = filter === "all" || filter === "products";
  const showStores = filter === "all" || filter === "stores";
  const showFood = filter === "all" || filter === "food";

  const field = (
    <View className="px-gutter pt-4">
      <View className="h-13 flex-row items-center gap-3 rounded-input border border-border bg-surface px-4">
        <Ionicons color={subtle as string} name="search" size={20} />
        <TextInput
          accessibilityLabel="Search products, shops and restaurants"
          autoCorrect={false}
          autoFocus={Boolean(handoff)}
          className="flex-1 font-sans text-body text-foreground"
          onChangeText={setTerm}
          placeholder={BRAND.searchPlaceholder}
          placeholderTextColor={subtle as string}
          returnKeyType="search"
          value={term}
        />
        {hasTerm ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setTerm("")}
          >
            <Ionicons color={foreground as string} name="close-circle" size={19} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  /* ---- Nothing typed yet: recent, then popular ------------------------- */
  if (!hasTerm) {
    return (
      <Screen edges={["top"]}>
        {field}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recent.length > 0 ? (
            <View className="pt-6">
              <SectionHeader
                actionLabel="Clear"
                onAction={() => {
                  void clearRecentSearches();
                  setRecent([]);
                }}
                title="Recent searches"
              />
              <View className="gap-0 px-gutter">
                {recent.map((item) => (
                  <Pressable
                    accessibilityLabel={`Search ${item}`}
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 py-3 active:opacity-60"
                    key={item}
                    onPress={() => setTerm(item)}
                  >
                    <Ionicons color={subtle as string} name="time-outline" size={17} />
                    <Text className="flex-1 font-sans text-body text-foreground">{item}</Text>
                    <Ionicons color={subtle as string} name="arrow-up-outline" size={15} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View className="pt-6">
            <SectionHeader subtitle="What Hindaun is buying" title="Popular searches" />
            <View className="flex-row flex-wrap gap-2 px-gutter">
              {POPULAR_SEARCHES.map((item) => (
                <Pressable
                  accessibilityLabel={`Search ${item}`}
                  accessibilityRole="button"
                  className="h-9 items-center justify-center rounded-pill border border-border bg-surface px-4 active:bg-muted"
                  key={item}
                  onPress={() => setTerm(item)}
                >
                  <Text className="font-label text-label text-text-secondary">{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      {field}

      {/* Filters only once there is something to filter. */}
      {!busy && total > 0 ? (
        <ScrollView
          className="mt-3 max-h-12"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map(([value, label]) => {
            const selected = filter === value;
            const count =
              value === "products"
                ? products.length
                : value === "stores"
                  ? stores.length
                  : value === "food"
                    ? restaurants.length
                    : total;

            if (count === 0 && value !== "all") return null;

            return (
              <Pressable
                accessibilityLabel={`${label}, ${count} results`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`h-9 flex-row items-center gap-1.5 rounded-pill border px-4 ${
                  selected
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface active:bg-muted"
                }`}
                key={value}
                onPress={() => setFilter(value)}
              >
                <Text
                  className={`text-label ${
                    selected ? "font-heading text-primary" : "font-label text-text-secondary"
                  }`}
                >
                  {label}
                </Text>
                <Text
                  className={`text-caption ${selected ? "text-primary" : "text-text-muted"}`}
                  style={{ fontVariant: ["tabular-nums"] }}
                >
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {busy ? (
          <View className="pt-6">
            <ProductGridSkeleton count={4} />
          </View>
        ) : isError ? (
          <ErrorState
            message="We could not run that search. Check your connection and try again."
            onRetry={() => void refetch()}
            title="Search is unavailable"
          />
        ) : total === 0 ? (
          <EmptyState
            actionLabel="Clear search"
            icon="search-outline"
            message={`Nothing matched "${term.trim()}". Try a shorter word, or check the spelling.`}
            onAction={() => setTerm("")}
            title="No results"
          />
        ) : (
          <>
            {showProducts && products.length > 0 ? (
              <View className="pt-5">
                <SectionHeader title="Products" />
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
              </View>
            ) : null}

            {showStores && stores.length > 0 ? (
              <View className="pt-7">
                <SectionHeader title="Shops" />
                <View className="gap-4 px-gutter">
                  {stores.map((store) => (
                    <StoreCard
                      key={store._id}
                      onPress={() =>
                        router.push({ params: { slug: store.slug }, pathname: "/store/[slug]" })
                      }
                      store={store}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {showFood && restaurants.length > 0 ? (
              <View className="pt-7">
                <SectionHeader title="Food" />
                <View className="gap-4 px-gutter">
                  {restaurants.map((restaurant) => (
                    <Pressable
                      accessibilityLabel={restaurant.name}
                      accessibilityRole="button"
                      className="flex-row items-center gap-3 active:opacity-70"
                      key={restaurant._id}
                      onPress={() =>
                        router.push({
                          params: {
                            id: restaurant._id,
                            image: restaurant.imageUrl,
                            slug: restaurant.slug,
                          },
                          pathname: "/restaurant/[slug]",
                        })
                      }
                    >
                      <View className="h-14 w-14 overflow-hidden rounded-card bg-muted" />
                      <View className="flex-1">
                        <Text className="font-label text-body text-foreground" numberOfLines={1}>
                          {restaurant.name}
                        </Text>
                        <Text className="font-sans text-caption text-text-muted" numberOfLines={1}>
                          {restaurant.cuisines?.join(" · ")}
                        </Text>
                      </View>
                      <Ionicons color={subtle as string} name="chevron-forward" size={16} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
