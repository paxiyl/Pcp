import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { AddressSheet } from "@/components/address-sheet";
import { BannerCarousel, type Banner } from "@/components/banner-carousel";
import { ProductCategoryStrip } from "@/components/product-category-strip";
import { ProductRail } from "@/components/product-rail";
import { ProductRailSkeleton, StoreListSkeleton } from "@/components/product-skeletons";
import { RestaurantCard } from "@/components/restaurant-card";
import { StoreCard } from "@/components/store-card";
import { ErrorState } from "@/components/ui/error-state";
import { SectionHeader } from "@/components/ui/section-header";
import { useBanners } from "@/features/catalogue/use-banners";
import { useProducts, useStores, useTopLevelCategories } from "@/features/catalogue/use-stores";
import { useRestaurants } from "@/features/catalogue/use-restaurants";
import { useDefaultAddress } from "@/features/location/use-addresses";
import { CategoryStrip } from "@/components/category-strip";
import { ModeSwitch } from "@/components/mode-switch";
import { VegToggle } from "@/components/veg-toggle";
import { useDeliveryMode } from "@/features/mode/delivery-mode";
import { BRAND } from "@/lib/brand";
import { useCurrentUser } from "@/features/auth/use-auth";

/**
 * Home.
 *
 * Ordered by what a quick-commerce customer is actually here to do: where it is
 * going, what they are looking for, then shelves — deals first because that is
 * what makes someone browse rather than search. Restaurants sit below the
 * grocery rails: this is a shop that also sells cooked food, not the other way
 * round.
 *
 * Everything below the categories loads independently, so one slow query cannot
 * hold the whole page blank.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = width - 40;

  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const handedOff = useRef(false);

  const { mode, progress } = useDeliveryMode();
  // Flips at the midpoint of the dissolve, so the swap happens while the
  // content is invisible rather than popping in front of the customer.
  const [shown, setShown] = useState<"grocery" | "food">("grocery");
  // Food-mode filters. "all" is the strip's own idea of no filter and is never
  // sent to the API.
  const [foodCategory, setFoodCategory] = useState("all");
  const [vegOnly, setVegOnly] = useState(false);
  const filtered = vegOnly || foodCategory !== "all";

  const foodWash = useAnimatedStyle(() => ({ opacity: progress.value }));
  // Full at either end, nothing at the midpoint: the content fades out, swaps
  // while it cannot be seen, and fades back in as one movement.
  const dissolve = useAnimatedStyle(() => ({
    opacity: Math.abs(progress.value - 0.5) * 2,
  }));

  useAnimatedReaction(
    () => progress.value > 0.5,
    (isFood, was) => {
      if (was !== null && isFood !== was) runOnJS(setShown)(isFood ? "food" : "grocery");
    },
  );

  const [headerFrom, headerTo, headerInk, primary, subtle, foodFrom, foodTo] = useCSSVariable([
    "--color-header-from",
    "--color-header-to",
    "--color-header-foreground",
    "--color-primary",
    "--color-text-muted",
    "--color-food-header-from",
    "--color-food-header-to",
  ]);

  const { data: user } = useCurrentUser();
  const { data: address } = useDefaultAddress();
  const { data: liveBanners, refetch: refetchBanners } = useBanners();
  const categories = useTopLevelCategories();
  const stores = useStores();
  const deals = useProducts({ limit: 10, sort: "discount" });
  const popular = useProducts({ limit: 10, sort: "popular" });
  const restaurants = useRestaurants({ category: foodCategory, veg: vegOnly });

  const refreshing =
    deals.isRefetching || popular.isRefetching || stores.isRefetching;

  const refreshAll = () => {
    void refetchBanners();
    void categories.refetch();
    void stores.refetch();
    void deals.refetch();
    void popular.refetch();
    void restaurants.refetch();
  };

  const published = (liveBanners ?? []).filter((banner) => banner.imageUrl);

  const bannerSlides: Banner[] = published.map((banner) => ({
    label: [banner.title, banner.subtitle].filter(Boolean).join(". "),
    onPress: () =>
      banner.categorySlug
        ? router.push({ params: { slug: banner.categorySlug }, pathname: "/category/[slug]" })
        : router.push("/search"),
    source: { uri: banner.imageUrl },
  }));

  /**
   * Hand off to the search screen the moment the field is touched. Waiting for
   * the first character loses the rest of the word: those keystrokes land here
   * while the push is still in flight.
   */
  const openSearch = () => {
    if (handedOff.current) return;

    handedOff.current = true;
    router.push({ params: { handoff: String(Date.now()) }, pathname: "/search" });

    setTimeout(() => {
      handedOff.current = false;
    }, 600);
  };

  const openProduct = (id: string) =>
    router.push({ params: { id }, pathname: "/product/[id]" });

  const greeting = user?.name ? `Hi ${user.name.split(" ")[0]}` : "Hi there";

  // Everything failed, not just one shelf. One message beats four.
  const allFailed = deals.isError && popular.isError && stores.isError;

  return (
    <View className="flex-1 bg-background">
      <View>
        {/* Two gradients rather than one animated one: LinearGradient cannot
            interpolate its own colours, so the food ramp is washed over the
            grocery ramp by opacity. Both sit behind the header content. */}
        <LinearGradient
          colors={[headerFrom as string, headerTo as string]}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, foodWash]}>
          <LinearGradient
            colors={[foodFrom as string, foodTo as string]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View className="px-gutter pb-9" style={{ paddingTop: insets.top + 12 }}>
          <View className="flex-row items-start justify-between">
            <Pressable
              accessibilityHint="Opens your saved delivery addresses"
              accessibilityLabel={`Deliver to ${address?.line1 ?? "choose an address"}`}
              accessibilityRole="button"
              className="flex-1 active:opacity-80"
              onPress={() => setAddressSheetOpen(true)}
            >
              <Text
                className="font-label text-caption uppercase"
                style={{ color: headerInk as string, letterSpacing: 1.2, opacity: 0.75 }}
              >
                Deliver to
              </Text>
              <View className="flex-row items-center gap-1">
                <Text
                  className="font-title text-section"
                  numberOfLines={1}
                  style={{ color: headerInk as string }}
                >
                  {address ? `${address.line1}, ${address.city}` : "Add an address"}
                </Text>
                <Ionicons color={headerInk as string} name="chevron-down" size={18} />
              </View>
            </Pressable>

            <Pressable
              accessibilityLabel="Your orders"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center active:opacity-80"
              hitSlop={8}
              onPress={() => router.push("/orders")}
            >
              <Ionicons color={headerInk as string} name="receipt-outline" size={23} />
            </Pressable>
          </View>

          {/* The speed promise, stated once, where it frames everything below. */}
          <Text
            className="mt-3 font-title text-display"
            style={{ color: headerInk as string, letterSpacing: -0.4 }}
          >
            {greeting}
          </Text>
          <Text
            className="font-sans text-body"
            style={{ color: headerInk as string, opacity: 0.88 }}
          >
            {mode === "food" ? "Hot food from kitchens near you" : BRAND.taglineEn}
          </Text>

          <View className="mt-4">
            <ModeSwitch />
          </View>
        </View>
      </View>

      <ScrollView
        className="-mt-6 rounded-t-sheet bg-background"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            colors={[primary as string]}
            onRefresh={refreshAll}
            refreshing={refreshing}
            tintColor={primary as string}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* A button, not a TextInput. Typing happens on the search screen, so a
            real field here only invites keystrokes that get thrown away. */}
        <View className="px-gutter pt-5">
          <Pressable
            accessibilityHint="Opens search"
            accessibilityLabel="Search products, shops and restaurants"
            accessibilityRole="search"
            className="h-13 flex-row items-center gap-3 rounded-input border border-border bg-surface px-4 active:bg-muted"
            onPress={openSearch}
          >
            <Ionicons color={subtle as string} name="search" size={20} />
            <Text className="flex-1 font-sans text-body text-text-muted" numberOfLines={1}>
              {BRAND.searchPlaceholder}
            </Text>
          </Pressable>
        </View>

        <Animated.View style={dissolve}>
          {shown === "grocery" ? (
            <>
        <View className="pt-5">
          <ProductCategoryStrip
            categories={categories.data ?? []}
            isLoading={categories.isLoading}
            onSelect={(slug) =>
              router.push({ params: { slug }, pathname: "/category/[slug]" })
            }
          />
        </View>

        {bannerSlides.length > 0 ? (
          <View className="px-gutter pt-6">
            <BannerCarousel banners={bannerSlides} width={contentWidth} />
          </View>
        ) : null}

        {allFailed ? (
          <ErrorState
            compact
            message="We could not load the shops near you. Check your connection and try again."
            onRetry={refreshAll}
          />
        ) : null}

        <View className="pt-7">
          {deals.isLoading ? (
            <ProductRailSkeleton />
          ) : (
            <ProductRail
              onPressProduct={openProduct}
              onSeeAll={() => router.push({ params: { slug: "all", sort: "discount" }, pathname: "/category/[slug]" })}
              products={deals.data?.products ?? []}
              subtitle="Biggest savings in Hindaun right now"
              title="Today's deals"
            />
          )}
        </View>

        <View className="pt-7">
          {popular.isLoading ? (
            <ProductRailSkeleton />
          ) : (
            <ProductRail
              onPressProduct={openProduct}
              onSeeAll={() => router.push({ params: { slug: "all" }, pathname: "/category/[slug]" })}
              products={popular.data?.products ?? []}
              title="Popular in Hindaun"
            />
          )}
        </View>

        <View className="pt-7">
          <SectionHeader subtitle="Delivering to you now" title="Shops near you" />
          {stores.isLoading ? (
            <StoreListSkeleton />
          ) : (
            <View className="gap-4 px-gutter">
              {(stores.data ?? []).slice(0, 5).map((store) => (
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
            </>
          ) : (
            <>
              {/* In grocery mode the kitchens were a horizontal rail below the
                  shelves. Here they ARE the screen, so they get full width and
                  the whole list rather than the first six. */}
              <View className="pt-5">
                <CategoryStrip onSelect={setFoodCategory} selectedSlug={foodCategory} />
              </View>

              <View className="flex-row items-center justify-between px-gutter pt-5">
                <Text className="font-title text-section text-foreground">Kitchens near you</Text>
                <VegToggle onChange={setVegOnly} value={vegOnly} />
              </View>

              <View className="pt-4">
                {restaurants.isLoading ? (
                  <StoreListSkeleton />
                ) : (restaurants.data ?? []).length === 0 ? (
                  <ErrorState
                    compact
                    message={
                      filtered
                        ? "No kitchens match that filter right now."
                        : "No kitchens are delivering to you yet. Swipe back to groceries, or try again shortly."
                    }
                    // Retrying a filter that matched nothing just fetches the
                    // same empty list, so the action clears the filter instead.
                    onRetry={
                      filtered
                        ? () => {
                            setFoodCategory("all");
                            setVegOnly(false);
                          }
                        : refreshAll
                    }
                    retryLabel={filtered ? "Clear filters" : undefined}
                  />
                ) : (
                  <View className="gap-4 px-gutter">
                    {(restaurants.data ?? []).map((restaurant) => (
                      <RestaurantCard
                        key={restaurant._id}
                        restaurant={restaurant}
                        width={contentWidth}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>

      <AddressSheet onClose={() => setAddressSheetOpen(false)} open={addressSheetOpen} />
    </View>
  );
}
