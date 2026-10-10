import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useCSSVariable } from "uniwind";

import { ProductRail } from "@/components/product-rail";
import { ProductRailSkeleton, StoreListSkeleton } from "@/components/product-skeletons";
import { StoreCard } from "@/components/store-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { SectionHeader } from "@/components/ui/section-header";
import { useProductCategories, useProducts, useStores } from "@/features/catalogue/use-stores";
import { PressableScale } from "@/components/ui/pressable-scale";

/**
 * Explore.
 *
 * Home is for people who know what they came for; this is for people who do not.
 * So it leads with the SHAPE of the catalogue — every department, as a browsable
 * mosaic — rather than another wall of product cards, which is what the brief
 * was asking for when it said "visual storytelling instead of a wall of cards".
 *
 * It matters more here than anywhere else that Raket sells medicine,
 * cosmetics and clothes alongside atta. A customer who only ever sees the home
 * screen's grocery rails will never find out.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [subtle] = useCSSVariable(["--color-text-muted"]);

  const categories = useProductCategories();
  const stores = useStores();
  // Prescription medicine is excluded from a browse surface: it cannot be
  // bought in the app, so surfacing it here only sets up a refusal.
  const trending = useProducts({ excludePrescription: true, limit: 10, sort: "rating" });
  const deals = useProducts({ excludePrescription: true, limit: 10, sort: "discount" });

  const topLevel = (categories.data ?? []).filter(
    (category) => !category.parentId && (category.productCount ?? 0) > 0,
  );

  // Two columns of tiles; the first is double-width so the mosaic has a focal
  // point instead of reading as a uniform grid.
  const gutter = 20;
  const gap = 12;
  const full = width - gutter * 2;
  const half = (full - gap) / 2;

  const openCategory = (slug: string) =>
    router.push({ params: { slug }, pathname: "/category/[slug]" });

  const openProduct = (id: string) =>
    router.push({ params: { id }, pathname: "/product/[id]" });

  if (categories.isError && stores.isError) {
    return (
      <Screen edges={["top"]}>
        <ErrorState
          message="We could not load what is on offer. Check your connection and try again."
          onRetry={() => {
            void categories.refetch();
            void stores.refetch();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-gutter pb-1 pt-4">
          <Text accessibilityRole="header" className="font-title text-display text-foreground">
            Explore
          </Text>
          <Text className="mt-0.5 font-sans text-body text-text-secondary">
            Everything Hindaun sells, in one place
          </Text>
        </View>

        <Pressable
          accessibilityHint="Opens search"
          accessibilityLabel="Search everything"
          accessibilityRole="search"
          className="mx-gutter mt-4 h-13 flex-row items-center gap-3 rounded-input border border-border bg-surface px-4 active:bg-muted"
          onPress={() => router.push("/search")}
        >
          <Ionicons color={subtle as string} name="search" size={20} />
          <Text className="flex-1 font-sans text-body text-text-muted">
            Medicine, cosmetics, clothes and more
          </Text>
        </Pressable>

        <View className="pt-7">
          <SectionHeader subtitle="Tap a department to browse" title="Shop by department" />

          {categories.isLoading ? (
            <View className="flex-row flex-wrap px-gutter" style={{ columnGap: gap, rowGap: gap }}>
              {[0, 1, 2, 3].map((key) => (
                <View
                  className="rounded-tile bg-muted"
                  key={key}
                  style={{ height: 104, width: half }}
                />
              ))}
            </View>
          ) : topLevel.length === 0 ? (
            <EmptyState
              compact
              icon="grid-outline"
              message="No shop near you has listed anything yet. Try again shortly."
              title="Nothing to explore yet"
            />
          ) : (
            <View className="flex-row flex-wrap px-gutter" style={{ columnGap: gap, rowGap: gap }}>
              {topLevel.map((category, index) => {
                // Every fifth tile runs full width, which breaks the grid up and
                // gives the eye somewhere to land while scrolling.
                const wide = index % 5 === 0;

                return (
                  <PressableScale
                    accessibilityHint={`${category.productCount} products`}
                    accessibilityLabel={category.name}
                    accessibilityRole="button"
                    className="justify-end overflow-hidden rounded-tile p-3.5"
                    key={category._id}
                    onPress={() => openCategory(category.slug)}
                    style={{
                      backgroundColor: category.backgroundColor,
                      height: wide ? 118 : 104,
                      width: wide ? full : half,
                    }}
                    weight="card"
                  >
                    {category.imageUrl ? (
                      <Image
                        accessibilityIgnoresInvertColors
                        alt=""
                        contentFit="contain"
                        source={{ uri: category.imageUrl }}
                        style={{
                          height: wide ? 86 : 64,
                          position: "absolute",
                          right: 10,
                          top: 10,
                          width: wide ? 86 : 64,
                        }}
                        transition={180}
                      />
                    ) : null}

                    <Text
                      className="font-heading text-section text-foreground"
                      numberOfLines={2}
                      style={{ maxWidth: wide ? full * 0.6 : half * 0.75 }}
                    >
                      {category.name}
                    </Text>
                    <Text className="mt-0.5 font-sans text-caption text-foreground opacity-60">
                      {category.productCount} items
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </View>

        <View className="pt-7">
          {deals.isLoading ? (
            <ProductRailSkeleton />
          ) : (
            <ProductRail
              onPressProduct={openProduct}
              onSeeAll={() =>
                router.push({
                  params: { slug: "all", sort: "discount" },
                  pathname: "/category/[slug]",
                })
              }
              products={deals.data?.products ?? []}
              subtitle="Across every department"
              title="Best savings"
            />
          )}
        </View>

        <View className="pt-7">
          {trending.isLoading ? (
            <ProductRailSkeleton />
          ) : (
            <ProductRail
              onPressProduct={openProduct}
              products={trending.data?.products ?? []}
              subtitle="Highest rated in Hindaun"
              title="Trending now"
            />
          )}
        </View>

        <View className="pt-7">
          <SectionHeader subtitle="Every shop delivering to you" title="Local shops" />
          {stores.isLoading ? (
            <StoreListSkeleton />
          ) : (
            <View className="gap-4 px-gutter">
              {(stores.data ?? []).map((store) => (
                <StoreCard
                  key={store._id}
                  onPress={() =>
                    router.push({ params: { slug: store.slug }, pathname: "/store/[slug]" })
                  }
                  store={store}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
