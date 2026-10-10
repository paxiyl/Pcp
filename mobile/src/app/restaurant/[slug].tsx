import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { CatalogueImage } from "@/components/catalogue-image";
import { BasketBar } from "@/components/basket-bar";
import { VegMark } from "@/components/veg-toggle";
import { RestaurantDetailSkeleton } from "@/components/restaurant-detail-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAddBasketItem, useBasket } from "@/features/basket/use-basket";
import { useRestaurant } from "@/features/catalogue/use-restaurants";
import type { Dish } from "@/lib/api";
import { formatClosingTime, formatPrepTime, formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const HERO_HEIGHT = 220;

export default function RestaurantDetailScreen() {
  const { image, slug } = useLocalSearchParams<{
    id?: string;
    image?: string;
    slug: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, error, isLoading } = useRestaurant(slug ?? "");
  const { data: basketData } = useBasket();
  const addItem = useAddBasketItem();
  const [primary, rating, muted, subtle, offer, border, foreground] = useCSSVariable([
    "--color-primary",
    "--color-rating",
    "--color-muted-foreground",
    "--color-subtle-foreground",
    "--color-offer",
    "--color-border",
    "--color-foreground",
  ]);

  if (isLoading) return <RestaurantDetailSkeleton />;

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-card px-5">
        <Ionicons color={subtle as string} name="storefront-outline" size={40} />
        <Text className="text-center font-heading text-section text-card-foreground">
          We couldn&apos;t open this restaurant
        </Text>
        <Text className="text-center font-sans text-body text-muted-foreground">
          It may have closed or moved. Try another one from the home feed.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-2 h-13 items-center justify-center rounded-input bg-primary px-6"
          // Opened straight from a link there is nothing to pop, so fall back to the feed.
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
        >
          <Text className="font-heading text-body text-primary-foreground">Back to restaurants</Text>
        </Pressable>
      </View>
    );
  }

  const { dishes, restaurant } = data;
  const heroImage = image || restaurant.imageUrl;
  const popular = dishes.filter((dish) => dish.isPopular);
  const hasOffer = restaurant.categories.some((category) => category.slug === "offers");

  const openDish = (dish: Dish) =>
    router.push({ pathname: "/dish/[id]", params: { id: dish._id } });

  /** One basket holds one restaurant, so switching kitchens asks first. */
  const handleAdd = (dish: Dish) => {
    // Nothing can be added blind when the dish needs a choice made.
    if (dish.optionGroups.some((group) => group.required)) {
      openDish(dish);

      return;
    }

    const submit = () =>
      addItem.mutate(
        { dishId: dish._id },
        {
          onError: (addError) =>
            toast.error("We could not add that", { description: addError.message }),
        },
      );

    // The server replaces a basket from another restaurant, so confirm first.
    if (basketData?.basket && basketData.basket.restaurantId !== restaurant._id) {
      Alert.alert(
        "Start a new basket?",
        `Your basket has items from ${basketData.restaurant?.name ?? "another restaurant"}. Adding ${dish.name} will clear it.`,
        [
          { style: "cancel", text: "Cancel" },
          { onPress: submit, style: "destructive", text: "Start new basket" },
        ],
      );

      return;
    }

    submit();
  };

  return (
    <View className="flex-1 bg-card">
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        {/* 0 — hero */}
        <View style={{ height: HERO_HEIGHT }}>
          {heroImage ? (
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={{ uri: heroImage }}
              style={{ height: HERO_HEIGHT, width: "100%" }}
              transition={250}
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-secondary">
              <Text className="font-title text-hero text-secondary-foreground">
                {restaurant.name.charAt(0)}
              </Text>
            </View>
          )}

          <View
            className="absolute left-0 right-0 flex-row justify-between px-5"
            style={{ top: insets.top + 8 }}
          >
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
            >
              <Ionicons color={foreground as string} name="arrow-back" size={22} />
            </Pressable>
            <Pressable
              accessibilityLabel="Save to favourites"
              accessibilityRole="button"
              className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80"
              onPress={() => router.push("/profile")}
            >
              <Ionicons color={foreground as string} name="heart-outline" size={22} />
            </Pressable>
          </View>
        </View>

        {/* 1 — restaurant information */}
        <View className="-mt-6 rounded-t-sheet bg-card px-5 pt-6">
          <Text accessibilityRole="header" className="font-title text-display text-card-foreground">
            {restaurant.name}
          </Text>
          <Text className="mt-1 font-sans text-body text-muted-foreground">
            {restaurant.cuisines.join(" • ")}
          </Text>

          <View className="mt-3 flex-row items-center gap-2">
            <Ionicons color={rating as string} name="star" size={16} />
            <Text className="font-heading text-body text-card-foreground">{restaurant.rating}</Text>
            <Text className="font-sans text-body text-muted-foreground">
              ({restaurant.ratingCount})
            </Text>
          </View>

          <View className="mt-5 flex-row gap-6 border-y border-border py-4">
            <Meta
              icon="time-outline"
              label="Delivery"
              value={formatPrepTime(restaurant.prepTimeMinMinutes, restaurant.prepTimeMaxMinutes)}
            />
            <Meta
              icon="bicycle-outline"
              label="Delivery fee"
              value={restaurant.deliveryFee === 0 ? "Free" : formatPrice(restaurant.deliveryFee)}
            />
            <Meta icon="basket-outline" label="Minimum" value={formatPrice(restaurant.minOrder)} />
          </View>

          <View className="mt-4 flex-row items-center gap-2">
            <Ionicons color={muted as string} name="time-outline" size={16} />
            <Text className="font-sans text-label text-muted-foreground">
              {restaurant.isOpen
                ? `Closes ${formatClosingTime(restaurant.closesAt)}`
                : "Currently closed"}
            </Text>
          </View>

          {restaurant.description ? (
            <Text className="mt-4 font-sans text-body text-muted-foreground">
              {restaurant.description}
            </Text>
          ) : null}

          {hasOffer ? (
            <View
              className="mt-5 flex-row items-center gap-3 rounded-card p-4"
              style={{ backgroundColor: "#FFF1DF" }}
            >
              <Ionicons color={offer as string} name="pricetag" size={22} />
              <View className="flex-1">
                <Text className="font-heading text-body text-card-foreground">
                  20% off selected favourites
                </Text>
                <Text className="font-sans text-label text-muted-foreground">
                  Offer applies to items marked eligible.
                </Text>
              </View>
            </View>
          ) : null}

          {popular.length > 0 ? (
            <>
              <Text
                accessibilityRole="header"
                className="pb-4 pt-7 font-heading text-section text-card-foreground"
              >
                Popular with other people
              </Text>
              <ScrollView
                contentContainerClassName="gap-4 pb-2"
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {popular.map((dish) => (
                  <Pressable
                    accessibilityHint="Opens the dish to customise it"
                    accessibilityLabel={dish.name}
                    accessibilityRole="button"
                    className="w-44 overflow-hidden rounded-card border border-border bg-card active:opacity-70"
                    key={dish._id}
                    onPress={() => openDish(dish)}
                  >
                    <View style={{ height: 104 }}>
                      <CatalogueImage
                        contentFit="cover"
                        imagePreset={dish.imagePreset}
                        imageUrl={dish.imageUrl}
                        name={dish.name}
                        size={104}
                      />
                    </View>
                    <View className="gap-1 p-3">
                      <View className="flex-row items-center gap-1.5">
                        {/* The mark sits before the name, which is the order it
                            is read in on a printed menu. */}
                        <VegMark color={dish.isVeg ? "#1fa85c" : "#c2410c"} size={11} />
                        <Text
                          className="flex-1 font-heading text-label text-card-foreground"
                          numberOfLines={1}
                        >
                          {dish.name}
                        </Text>
                      </View>
                      <Text className="font-label text-label text-card-foreground">
                        {formatPrice(dish.price)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>

        {/* 2 — sticky menu header. A menu this size reads better flat than behind tabs. */}
        <View
          className="flex-row items-center justify-between bg-card px-5 py-4"
          style={{ borderBottomColor: border as string, borderBottomWidth: 1 }}
        >
          <Text
            accessibilityRole="header"
            className="font-heading text-section text-card-foreground"
          >
            All dishes
          </Text>
          <Text className="font-label text-label text-muted-foreground">
            {dishes.length} {dishes.length === 1 ? "item" : "items"}
          </Text>
        </View>

        {/* 3 — the menu: image left, details centre, add on the right */}
        {dishes.length === 0 ? (
          /* A kitchen that has signed up but not listed anything yet. Common
             while owners are onboarding, and it used to render as a bare "0
             items" header above blank space. */
          <EmptyState
            icon="restaurant-outline"
            message={`${restaurant.name} is set up on Raket but has not put its menu in yet. It should not be long.`}
            title="Menu coming soon"
          />
        ) : null}

        <View className="px-5">
          {dishes.map((dish, index) => (
            <Pressable
              accessibilityHint="Opens the dish to customise it"
              accessibilityLabel={dish.name}
              accessibilityRole="button"
              className={`flex-row items-center gap-4 py-4 active:opacity-70 ${
                index > 0 ? "border-t border-border" : ""
              }`}
              key={dish._id}
              onPress={() => openDish(dish)}
            >
              <View className="overflow-hidden rounded-input" style={{ height: 72, width: 72 }}>
                <CatalogueImage
                  contentFit="cover"
                  imagePreset={dish.imagePreset}
                  imageUrl={dish.imageUrl}
                  name={dish.name}
                  size={72}
                />
              </View>

              <View className="flex-1 gap-1">
                <Text className="font-heading text-body text-card-foreground">{dish.name}</Text>
                {dish.description ? (
                  <Text className="font-sans text-label text-muted-foreground" numberOfLines={2}>
                    {dish.description}
                  </Text>
                ) : null}
                <Text className="mt-1 font-label text-body text-card-foreground">
                  {formatPrice(dish.price)}
                </Text>
              </View>

              <Pressable
                accessibilityLabel={`Add ${dish.name} to basket`}
                accessibilityRole="button"
                className="h-9 w-9 items-center justify-center rounded-pill active:bg-secondary"
                hitSlop={8}
                onPress={() => handleAdd(dish)}
                style={{ borderColor: primary as string, borderWidth: 2 }}
              >
                <Ionicons color={primary as string} name="add" size={20} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <BasketBar vendorId={restaurant._id} />
    </View>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: "time-outline" | "bicycle-outline" | "basket-outline";
  label: string;
  value: string;
}) {
  const [muted] = useCSSVariable(["--color-muted-foreground"]);

  return (
    <View className="flex-1 gap-1">
      <View className="flex-row items-center gap-1.5">
        <Ionicons color={muted as string} name={icon} size={16} />
        <Text className="font-heading text-label text-card-foreground">{value}</Text>
      </View>
      <Text className="font-sans text-caption text-muted-foreground">{label}</Text>
    </View>
  );
}
