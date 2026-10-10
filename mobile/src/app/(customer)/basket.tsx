import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  useBasket,
  useSetBasketItemQuantity,
  useUpdateBasket,
} from "@/features/basket/use-basket";
import { formatEta, formatPrice } from "@/lib/format";
import { CatalogueImage } from "@/components/catalogue-image";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/sonner";

export default function BasketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useBasket();
  const setQuantity = useSetBasketItemQuantity();
  const updateBasket = useUpdateBasket();
  const [primary, primaryTint, subtle, muted, border, success, foreground] = useCSSVariable(
    [
      "--color-primary",
      "--color-secondary",
      "--color-subtle-foreground",
      "--color-muted-foreground",
      "--color-border",
      "--color-success",
      "--color-foreground",
    ],
  );

  const basket = data?.basket ?? null;
  const restaurant = data?.restaurant ?? null;
  // Populated for both catalogues; `restaurant` is null for a store basket, so
  // guarding on it alone rendered every grocery basket as empty.
  const vendor = data?.vendor ?? null;
  const store = data?.store ?? null;
  const totals = data?.totals;

  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Keep the draft in step when the basket arrives or changes elsewhere.
  useEffect(() => {
    setNote(basket?.orderNote ?? "");
  }, [basket?.orderNote]);

  /** Routes back to whichever catalogue page this basket came from. */
  const openVendor = () => {
    if (vendor?.kind === "store" && store) {
      router.push({ params: { slug: store.slug }, pathname: "/store/[slug]" });

      return;
    }

    if (restaurant) {
      router.push({
        params: { id: restaurant._id, image: restaurant.imageUrl, slug: restaurant.slug },
        pathname: "/restaurant/[slug]",
      });
    }
  };

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/home");

  const renderHeader = () => (
    <View className="flex-row items-center px-5 py-3">
      {/* Only shown when the basket was pushed (from the floating cart bar). As a
          tab it is a destination, and an arrow that pops to whatever was
          underneath would be lying about where it goes. */}
      {router.canGoBack() ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="-ml-2 h-11 w-11 items-center justify-center"
          hitSlop={8}
          onPress={close}
        >
          <Ionicons color={foreground as string} name="arrow-back" size={24} />
        </Pressable>
      ) : (
        <View className="h-11 w-11" />
      )}
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-title text-title text-foreground"
      >
        Basket
      </Text>
      <View className="h-11 w-11" />
    </View>
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {renderHeader()}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primary as string} size="large" />
        </View>
      </View>
    );
  }

  if (!basket || !vendor || !totals || basket.items.length === 0) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {renderHeader()}
        <EmptyState
          actionLabel="Start shopping"
          icon="basket-outline"
          message="Groceries, daily essentials and food from shops near you turn up here once you add them."
          onAction={close}
          title="Your basket is empty"
        />
      </View>
    );
  }

  const freeDeliveryProgress =
    totals.freeDeliveryThreshold && totals.amountToFreeDelivery !== null
      ? Math.min(totals.subtotal / totals.freeDeliveryThreshold, 1)
      : 1;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {renderHeader()}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Restaurant */}
        <View className="mx-5 flex-row items-center gap-3 rounded-card border border-border bg-card p-4">
          {vendor.imageUrl ? (
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={{ uri: vendor.imageUrl }}
              style={{ borderRadius: 12, height: 52, width: 52 }}
              transition={200}
            />
          ) : (
            <View
              className="items-center justify-center rounded-input bg-secondary"
              style={{ height: 52, width: 52 }}
            >
              <Text className="font-title text-section text-secondary-foreground">
                {vendor.name.charAt(0)}
              </Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="font-heading text-body text-card-foreground">{vendor.name}</Text>
            <Text className="font-sans text-label text-muted-foreground">
              Delivery • {formatEta(vendor.etaMinutes)}
            </Text>
            {/* Address only exists on the full records, not the vendor summary. */}
            {restaurant?.address || store?.address ? (
              <Text className="font-sans text-label text-muted-foreground" numberOfLines={1}>
                {restaurant?.address ?? store?.address}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityLabel={vendor.kind === "store" ? "Change store" : "Change restaurant"}
            accessibilityRole="link"
            onPress={() => openVendor()}
          >
            <Text className="font-heading text-label text-primary">Change</Text>
          </Pressable>
        </View>

        {/* Items */}
        <View className="mx-5 mt-3 overflow-hidden rounded-card border border-border bg-card">
          {basket.items.map((item, index) => (
            <View
              className={`flex-row items-center gap-3 p-4 ${
                index > 0 ? "border-t border-border" : ""
              }`}
              key={item._id}
            >
              {item.imageUrl || item.imagePreset ? (
                <View className="overflow-hidden rounded-input" style={{ height: 56, width: 56 }}>
                  <CatalogueImage
                    contentFit="cover"
                    imagePreset={item.imagePreset}
                    imageUrl={item.imageUrl}
                    name={item.name}
                    size={56}
                  />
                </View>
              ) : (
                <View
                  className="items-center justify-center rounded-input bg-muted"
                  style={{ height: 56, width: 56 }}
                >
                  <Ionicons
                    color={subtle as string}
                    name="restaurant-outline"
                    size={20}
                  />
                </View>
              )}

              <View className="flex-1 gap-1">
                <Text className="font-heading text-body text-card-foreground">
                  {item.name}
                </Text>
                {item.optionNames.length > 0 ? (
                  <Text
                    className="font-sans text-label text-muted-foreground"
                    numberOfLines={2}
                  >
                    {item.optionNames.join(", ")}
                  </Text>
                ) : null}
                {item.note ? (
                  <Text
                    className="font-sans text-caption text-subtle-foreground"
                    numberOfLines={1}
                  >
                    “{item.note}”
                  </Text>
                ) : null}

                <View className="mt-1 flex-row items-center gap-3">
                  <Pressable
                    accessibilityLabel={`Remove one ${item.name}`}
                    accessibilityRole="button"
                    className="h-8 w-8 items-center justify-center rounded-pill active:bg-secondary"
                    disabled={setQuantity.isPending}
                    hitSlop={4}
                    onPress={() =>
                      setQuantity.mutate({
                        itemId: item._id,
                        quantity: item.quantity - 1,
                      })
                    }
                    style={{ borderColor: border as string, borderWidth: 1 }}
                  >
                    <Ionicons
                      color={primary as string}
                      name={item.quantity === 1 ? "trash-outline" : "remove"}
                      size={16}
                    />
                  </Pressable>
                  <Text className="min-w-4 text-center font-heading text-body text-card-foreground">
                    {item.quantity}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Add one ${item.name}`}
                    accessibilityRole="button"
                    className="h-8 w-8 items-center justify-center rounded-pill active:bg-secondary"
                    disabled={setQuantity.isPending}
                    hitSlop={4}
                    onPress={() =>
                      setQuantity.mutate({
                        itemId: item._id,
                        quantity: item.quantity + 1,
                      })
                    }
                    style={{ borderColor: border as string, borderWidth: 1 }}
                  >
                    <Ionicons color={primary as string} name="add" size={16} />
                  </Pressable>
                </View>
              </View>

              <Text className="font-label text-body text-card-foreground">
                {formatPrice(item.unitPrice * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          className="mx-5 mt-3 h-13 flex-row items-center justify-center gap-2 rounded-input border border-primary bg-card active:bg-secondary"
          onPress={() =>
            router.push({
              pathname: "/restaurant/[slug]",
              params: { id: vendor.id, image: vendor.imageUrl, slug: restaurant?.slug ?? "" },
            })
          }
        >
          <Ionicons color={primary as string} name="add" size={20} />
          <Text className="font-heading text-body text-primary">
            Add more items
          </Text>
        </Pressable>

        {/* Preferences */}
        <View className="mx-5 mt-5 overflow-hidden rounded-card border border-border bg-card">
          <View className="flex-row items-center gap-3 p-4">
            <Ionicons
              color={muted as string}
              name="restaurant-outline"
              size={20}
            />
            <Text className="flex-1 font-label text-body text-card-foreground">
              Cutlery
            </Text>
            <Text className="font-sans text-label text-muted-foreground">
              Include cutlery
            </Text>
            <Switch
              accessibilityLabel="Include cutlery"
              ios_backgroundColor={String(border)}
              onValueChange={(value) =>
                updateBasket.mutate({ includeCutlery: value })
              }
              thumbColor={basket.includeCutlery ? String(primary) : "#ffffff"}
              trackColor={{ false: String(border), true: String(primaryTint) }}
              value={basket.includeCutlery}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-border p-4 active:bg-muted"
            onPress={() =>
              toast("Tell the kitchen in your order note", {
                description: "Allergen details are listed on each dish.",
              })
            }
          >
            <Ionicons
              color={muted as string}
              name="information-circle-outline"
              size={20}
            />
            <Text className="flex-1 font-label text-body text-card-foreground">
              Allergy or dietary reminder
            </Text>
            <Ionicons
              color={muted as string}
              name="chevron-forward"
              size={18}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-border p-4 active:bg-muted"
            onPress={() => setNoteOpen((open) => !open)}
          >
            <Ionicons
              color={muted as string}
              name="document-text-outline"
              size={20}
            />
            <View className="flex-1">
              <Text className="font-label text-body text-card-foreground">
                Order notes{" "}
                <Text className="font-sans text-label text-muted-foreground">
                  (optional)
                </Text>
              </Text>
              <Text
                className="font-sans text-label text-muted-foreground"
                numberOfLines={1}
              >
                {basket.orderNote || "Add a note for the restaurant"}
              </Text>
            </View>
            <Ionicons
              color={muted as string}
              name={noteOpen ? "chevron-down" : "chevron-forward"}
              size={18}
            />
          </Pressable>

          {noteOpen ? (
            <View className="gap-3 border-t border-border p-4">
              <TextInput
                accessibilityLabel="Order note for the restaurant"
                className="min-h-13 rounded-input border border-border bg-card px-4 py-3 font-sans text-body text-card-foreground"
                multiline
                onChangeText={setNote}
                placeholder="E.g. Ring the top bell, no cutlery needed"
                placeholderTextColor={subtle as string}
                value={note}
              />
              <Pressable
                accessibilityRole="button"
                className="h-11 items-center justify-center rounded-input bg-primary active:bg-primary-pressed"
                onPress={() => {
                  updateBasket.mutate({ orderNote: note });
                  setNoteOpen(false);
                }}
              >
                <Text className="font-heading text-label text-primary-foreground">
                  Save note
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Free delivery progress */}
        {totals.freeDeliveryThreshold !== null ? (
          <View className="mx-5 mt-5 gap-2">
            <View className="flex-row items-center gap-3">
              <Text className="flex-1 font-heading text-label text-foreground">
                {totals.amountToFreeDelivery === null
                  ? "You have free delivery on this order"
                  : `Add ${formatPrice(totals.amountToFreeDelivery)} more for FREE delivery`}
              </Text>
              <Ionicons
                color={
                  totals.amountToFreeDelivery === null
                    ? (success as string)
                    : (primary as string)
                }
                name="bicycle"
                size={22}
              />
            </View>
            <View className="h-2 overflow-hidden rounded-pill bg-muted">
              <View
                className="h-full rounded-pill bg-primary"
                style={{ width: `${Math.round(freeDeliveryProgress * 100)}%` }}
              />
            </View>
          </View>
        ) : null}

        {/* Totals */}
        <View className="mx-5 mt-5 gap-3">
          <Row label="Subtotal" value={formatPrice(totals.subtotal)} />
          {totals.savings > 0 ? (
            <Row
              label="Savings"
              tone="success"
              value={`-${formatPrice(totals.savings)}`}
            />
          ) : null}
          <Row
            label="Delivery fee"
            value={
              totals.deliveryFee === 0
                ? "Free"
                : formatPrice(totals.deliveryFee)
            }
          />
          <Row label="Service fee" value={formatPrice(totals.serviceFee)} />

          <View className="mt-1 flex-row items-center justify-between border-t border-border pt-4">
            <Text className="font-heading text-section text-foreground">
              Total
            </Text>
            <Text className="font-title text-title text-foreground">
              {formatPrice(totals.total)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="border-t border-border bg-card px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Pressable
          accessibilityLabel={`Checkout, ${formatPrice(totals.total)}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: totals.belowMinimum }}
          className={`h-13 flex-row items-center justify-center gap-2 rounded-input bg-primary active:bg-primary-pressed ${
            totals.belowMinimum ? "opacity-60" : ""
          }`}
          disabled={totals.belowMinimum}
          onPress={() => router.push("/checkout")}
        >
          <Text className="font-heading text-body text-primary-foreground">
            {totals.belowMinimum
              ? `${formatPrice(totals.minOrder - totals.subtotal)} to reach the minimum`
              : `Checkout • ${formatPrice(totals.total)}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A line in the price breakdown. `tone` is the only colour this component takes. */
function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  const success = tone === "success";

  return (
    <View className="flex-row items-center justify-between">
      <Text className={`font-sans text-body ${success ? "text-success" : "text-muted-foreground"}`}>
        {label}
      </Text>
      <Text className={`font-label text-body ${success ? "text-success" : "text-foreground"}`}>
        {value}
      </Text>
    </View>
  );
}
