import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  findBasketLine,
  useAddBasketItem,
  useBasket,
  useSetBasketItemQuantity,
} from "@/features/basket/use-basket";
import { useDish } from "@/features/catalogue/use-restaurants";
import type { DishOptionGroup } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

const HERO_HEIGHT = 240;

/** Chosen option ids, keyed by group id. Single-choice groups hold one entry. */
type Selection = Record<string, string[]>;

const defaultSelection = (groups: DishOptionGroup[]): Selection =>
  Object.fromEntries(
    groups.map((group) => {
      const preselected = group.options.find((option) => option.isDefault);

      // A required choice starts on its default (or the first) so the CTA is never blocked.
      if (group.type === "single" && group.required) {
        return [group._id, [preselected?._id ?? group.options[0]?._id].filter(Boolean) as string[]];
      }

      return [group._id, preselected ? [preselected._id] : []];
    }),
  );

export default function DishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, error, isLoading } = useDish(id ?? "");
  const [primary, subtle, muted, border, foreground] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-muted-foreground",
    "--color-border",
    "--color-foreground",
  ]);

  const { data: basketData } = useBasket();
  const addItem = useAddBasketItem();
  const setQuantity = useSetBasketItemQuantity();
  const groups = data?.dish.optionGroups ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const [note, setNote] = useState("");

  const active = selection ?? defaultSelection(groups);

  const { optionIds, optionNames, unitPrice } = useMemo(() => {
    const base = data?.dish.price ?? 0;
    const names: string[] = [];
    const ids: string[] = [];
    let extra = 0;

    for (const group of groups) {
      for (const optionId of active[group._id] ?? []) {
        const option = group.options.find((candidate) => candidate._id === optionId);

        if (!option) continue;

        names.push(option.name);
        ids.push(option._id);
        extra += option.priceDelta;
      }
    }

    return { optionIds: ids, optionNames: names, unitPrice: base + extra };
  }, [active, data?.dish.price, groups]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));

  if (isLoading) {
    return (
      <View className="flex-1 bg-card">
        <View className="bg-muted" style={{ height: HERO_HEIGHT }} />
        <View className="gap-3 px-5 pt-6">
          <View className="h-7 w-56 rounded-input bg-muted" />
          <View className="h-4 w-32 rounded-input bg-muted" />
          <View className="mt-2 h-4 w-full rounded-input bg-muted" />
          <View className="h-4 w-3/4 rounded-input bg-muted" />
          <View className="mt-6 h-5 w-40 rounded-input bg-muted" />
          {[0, 1, 2].map((key) => (
            <View className="mt-2 h-6 w-full rounded-input bg-muted" key={key} />
          ))}
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-card px-5">
        <Ionicons color={subtle as string} name="fast-food-outline" size={40} />
        <Text className="text-center font-heading text-section text-card-foreground">
          We couldn&apos;t open this dish
        </Text>
        <Text className="text-center font-sans text-body text-muted-foreground">
          It may be off the menu right now.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="mt-2 h-13 items-center justify-center rounded-input bg-primary px-6"
          onPress={close}
        >
          <Text className="font-heading text-body text-primary-foreground">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const { dish, restaurant } = data;

  const toggle = (group: DishOptionGroup, optionId: string) => {
    const current = active[group._id] ?? [];

    const next =
      group.type === "single"
        ? // A required single choice can be swapped but never emptied.
          group.required || !current.includes(optionId)
          ? [optionId]
          : []
        : current.includes(optionId)
          ? current.filter((value) => value !== optionId)
          : [...current, optionId];

    setSelection({ ...active, [group._id]: next });
  };

  // Changing an option makes a different line, so the footer flips back to Add.
  const line = findBasketLine(basketData?.basket?.items ?? [], dish._id, optionNames, note);
  const inBasket = line?.quantity ?? 0;
  const busy = addItem.isPending || setQuantity.isPending;

  const missingRequired = groups.filter(
    (group) => group.required && (active[group._id] ?? []).length === 0,
  );

  const handleAdd = () => {
    if (missingRequired.length > 0 || busy) return;

    const submit = () =>
      addItem.mutate(
        { dishId: dish._id, note: note.trim() || undefined, optionIds },
        {
          onError: (addError) =>
            toast.error("We could not add that", { description: addError.message }),
        },
      );

    // The server replaces a basket from another restaurant, so confirm first.
    const otherRestaurant =
      basketData?.basket && basketData.basket.restaurantId !== restaurant._id;

    if (otherRestaurant) {
      Alert.alert(
        "Start a new basket?",
        `Your basket has items from ${basketData?.restaurant?.name ?? "another restaurant"}. Adding ${dish.name} will clear it.`,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: HERO_HEIGHT }}>
            {dish.imageUrl ? (
              <Image
                accessibilityIgnoresInvertColors
                alt=""
                contentFit="cover"
                source={{ uri: dish.imageUrl }}
                style={{ height: HERO_HEIGHT, width: "100%" }}
                transition={250}
              />
            ) : (
              <View className="h-full w-full items-center justify-center bg-muted">
                <Ionicons color={subtle as string} name="restaurant-outline" size={40} />
              </View>
            )}

            <View
              className="absolute left-0 right-0 flex-row justify-between px-5"
              style={{ top: insets.top + 8 }}
            >
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-pill bg-card active:opacity-80"
                onPress={close}
              >
                <Ionicons color={foreground as string} name="close" size={22} />
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

          <View className="px-5 pt-5">
            <Text
              accessibilityRole="header"
              className="font-title text-display text-card-foreground"
            >
              {dish.name}
            </Text>
            <Text className="mt-1 font-label text-body text-card-foreground">
              {formatPrice(dish.price)}
              {dish.calories ? (
                <Text className="font-sans text-body text-muted-foreground">
                  {"  •  "}
                  {dish.calories} kcal
                </Text>
              ) : null}
            </Text>

            {dish.description ? (
              <Text className="mt-3 font-sans text-body text-muted-foreground">
                {dish.description}
              </Text>
            ) : null}

            {dish.allergens.length > 0 ? (
              <View className="mt-3 flex-row items-center gap-2">
                <Ionicons color={muted as string} name="information-circle-outline" size={16} />
                <Text className="font-sans text-label text-muted-foreground">
                  Contains: {dish.allergens.join(", ")}
                </Text>
              </View>
            ) : null}
          </View>

          {groups.map((group) => (
            <View
              className="mt-6 px-5 pt-5"
              key={group._id}
              style={{ borderTopColor: border as string, borderTopWidth: 1 }}
            >
              <Text className="font-heading text-body text-card-foreground">
                {group.name}{" "}
                <Text className="font-sans text-label text-muted-foreground">
                  ({group.required ? "required" : "optional"})
                </Text>
              </Text>

              <View className="mt-3">
                {group.options.map((option) => {
                  const selected = (active[group._id] ?? []).includes(option._id);
                  const isRadio = group.type === "single";
                  // Size-style choices read as a full price, add-ons as a surcharge.
                  const displayPrice =
                    isRadio && group.required ? dish.price + option.priceDelta : option.priceDelta;

                  return (
                    <Pressable
                      accessibilityLabel={option.name}
                      accessibilityRole={isRadio ? "radio" : "checkbox"}
                      accessibilityState={{ checked: selected, selected }}
                      className="flex-row items-center gap-3 py-3 active:opacity-70"
                      key={option._id}
                      onPress={() => toggle(group, option._id)}
                    >
                      <Ionicons
                        color={selected ? (primary as string) : (subtle as string)}
                        name={
                          isRadio
                            ? selected
                              ? "radio-button-on"
                              : "radio-button-off"
                            : selected
                              ? "checkbox"
                              : "square-outline"
                        }
                        size={22}
                      />
                      <Text className="flex-1 font-sans text-body text-card-foreground">
                        {option.name}
                      </Text>
                      {displayPrice > 0 ? (
                        <Text className="font-label text-body text-card-foreground">
                          {formatPrice(displayPrice)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          <View
            className="mt-6 px-5 pt-5"
            style={{ borderTopColor: border as string, borderTopWidth: 1 }}
          >
            <Text className="font-heading text-body text-card-foreground">
              Add a note{" "}
              <Text className="font-sans text-label text-muted-foreground">(optional)</Text>
            </Text>
            <TextInput
              accessibilityLabel="Add a note for the kitchen"
              className="mt-3 h-13 rounded-input border border-border bg-card px-4 font-sans text-body text-card-foreground"
              onChangeText={setNote}
              placeholder="E.g. Extra crispy base, no onion"
              placeholderTextColor={subtle as string}
              value={note}
            />
          </View>

        </ScrollView>

        <View
          className="border-t border-border bg-card px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {inBasket > 0 ? (
            <View className="h-13 flex-row items-center justify-between rounded-input bg-secondary px-2">
              <Pressable
                accessibilityLabel={`Remove one ${dish.name}`}
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-pill active:bg-card"
                disabled={busy}
                onPress={() =>
                  line && setQuantity.mutate({ itemId: line._id, quantity: inBasket - 1 })
                }
              >
                <Ionicons
                  color={primary as string}
                  name={inBasket === 1 ? "trash-outline" : "remove-circle-outline"}
                  size={26}
                />
              </Pressable>

              <Text className="font-heading text-body text-secondary-foreground">
                {inBasket} in basket · {formatPrice(unitPrice * inBasket)}
              </Text>

              <Pressable
                accessibilityLabel={`Add another ${dish.name}`}
                accessibilityRole="button"
                className="h-10 w-10 items-center justify-center rounded-pill active:bg-card"
                disabled={busy}
                onPress={() =>
                  line && setQuantity.mutate({ itemId: line._id, quantity: inBasket + 1 })
                }
              >
                <Ionicons color={primary as string} name="add-circle-outline" size={26} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityLabel={`Add ${dish.name} to basket for ${formatPrice(unitPrice)}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: missingRequired.length > 0 }}
              className={`h-13 items-center justify-center rounded-input bg-primary active:bg-primary-pressed ${
                missingRequired.length > 0 ? "opacity-60" : ""
              }`}
              disabled={missingRequired.length > 0}
              onPress={handleAdd}
            >
              <Text className="font-heading text-body text-primary-foreground">
                {missingRequired.length > 0
                  ? `Choose ${missingRequired[0].name.toLowerCase()}`
                  : `Add for ${formatPrice(unitPrice)}`}
              </Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
