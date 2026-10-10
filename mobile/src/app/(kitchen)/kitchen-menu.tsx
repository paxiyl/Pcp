import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { CatalogueImage } from "@/components/catalogue-image";
import { VegMark } from "@/components/veg-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteKitchenDish,
  useKitchenDishes,
  useSetDishAvailable,
} from "@/features/kitchen/use-kitchen";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

/**
 * The menu, as a service-time control rather than an editor.
 *
 * One switch per dish, and nothing else inline. A kitchen mid-service needs
 * exactly one thing from its menu — "the paneer has run out, stop selling it" —
 * and putting price and description fields on the same screen is how someone
 * changes a price with floury hands at seven in the evening.
 *
 * Adding and removing a dish are separate, deliberate acts, so they are a
 * screen you navigate to and a confirm you have to answer. That is what lets
 * this one stay a row of switches.
 *
 * Sections are the kitchen's own, in menu order, because that is how they think
 * about their food and how the customer sees it.
 */
export default function KitchenMenuScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [subtle, destructive] = useCSSVariable([
    "--color-subtle-foreground",
    "--color-destructive",
  ]);

  const { data: dishes, isLoading, isError, refetch } = useKitchenDishes();
  const setAvailable = useSetDishAvailable();
  const remove = useDeleteKitchenDish();

  const term = search.trim().toLowerCase();

  const sections = useMemo(() => {
    const matching = (dishes ?? []).filter((dish) =>
      term ? dish.name.toLowerCase().includes(term) : true,
    );

    const grouped = new Map<string, typeof matching>();

    for (const dish of matching) {
      const key = dish.section || "Menu";

      grouped.set(key, [...(grouped.get(key) ?? []), dish]);
    }

    return [...grouped.entries()];
  }, [dishes, term]);

  const offCount = (dishes ?? []).filter((dish) => !dish.isAvailable).length;

  const toggle = async (dishId: string, isAvailable: boolean) => {
    try {
      await setAvailable.mutateAsync({ dishId, isAvailable });
    } catch (error) {
      toast.error("Could not update that dish", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  /*
    Removing is not the same as running out, and the confirm says so. Nine times
    out of ten the dish is back tomorrow and the switch is the right answer, so
    the dialog offers it rather than only asking "are you sure".
  */
  const confirmRemove = (dishId: string, name: string) => {
    Alert.alert(
      `Remove ${name}?`,
      "It comes off your menu for good. If you have only run out for today, switch it off instead.",
      [
        { style: "cancel", text: "Keep it" },
        {
          onPress: async () => {
            try {
              await remove.mutateAsync(dishId);
              toast.success(`${name} removed`);
            } catch (error) {
              toast.error("Could not remove that dish", {
                description: error instanceof Error ? error.message : "Please try again.",
              });
            }
          },
          style: "destructive",
          text: "Remove",
        },
      ],
    );
  };

  return (
    <Screen edges={["top"]}>
      <View className="flex-row items-center gap-3 px-gutter pt-4">
        <View className="flex-1">
          <Text accessibilityRole="header" className="font-title text-display text-foreground">
            Menu
          </Text>
          <Text className="font-sans text-label text-text-secondary">
            {offCount > 0
              ? `${offCount} switched off · customers cannot order ${offCount === 1 ? "it" : "them"}`
              : "Everything is on sale"}
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Add a dish"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-pill bg-primary active:bg-primary-pressed"
          onPress={() => router.push("/dish-new")}
        >
          <Ionicons color="#ffffff" name="add" size={24} />
        </Pressable>
      </View>

      <View className="mx-gutter mt-3 flex-row items-center gap-2 rounded-input border border-border bg-surface px-3">
        <Ionicons color={subtle as string} name="search-outline" size={18} />
        <TextInput
          accessibilityLabel="Search your menu"
          autoCapitalize="none"
          autoCorrect={false}
          className="h-12 flex-1 font-sans text-body text-foreground"
          onChangeText={setSearch}
          placeholder="Search your dishes"
          placeholderTextColor={subtle as string}
          returnKeyType="search"
          value={search}
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityLabel="Clear search"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setSearch("")}
          >
            <Ionicons color={subtle as string} name="close-circle" size={18} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View className="gap-3 px-gutter pt-4">
            {[0, 1, 2, 3, 4].map((key) => (
              <Skeleton className="h-20 rounded-card" key={key} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            message="We could not load your menu. Check your connection and try again."
            onRetry={() => void refetch()}
            title="Menu unavailable"
          />
        ) : sections.length === 0 ? (
          <EmptyState
            icon="fast-food-outline"
            message={
              term
                ? `Nothing on your menu matches "${search.trim()}".`
                : "Add your first dish and customers can order it straight away."
            }
            title={term ? "No match" : "No dishes yet"}
            {...(term
              ? { actionLabel: "Clear search", onAction: () => setSearch("") }
              : { actionLabel: "Add a dish", onAction: () => router.push("/dish-new") })}
          />
        ) : (
          sections.map(([section, items]) => (
            <View className="pt-5" key={section}>
              <Text
                className="px-gutter pb-2 font-label text-caption uppercase text-text-muted"
                style={{ letterSpacing: 1.2 }}
              >
                {section}
              </Text>

              <View className="mx-gutter overflow-hidden rounded-card bg-surface">
                {items.map((dish, index) => (
                  <View
                    className={`flex-row items-center gap-3 p-3 ${
                      index > 0 ? "border-t border-border" : ""
                    }`}
                    key={dish._id}
                  >
                    <View
                      className="overflow-hidden rounded-input"
                      style={{ height: 48, opacity: dish.isAvailable ? 1 : 0.45, width: 48 }}
                    >
                      <CatalogueImage
                        contentFit="cover"
                        imagePreset={dish.imagePreset}
                        imageUrl={dish.imageUrl}
                        name={dish.name}
                        size={48}
                      />
                    </View>

                    {/* The name opens the editor; the switch and the bin do not,
                        so a tap meant for one is never the other. */}
                    <Pressable
                      accessibilityHint="Opens the dish for editing"
                      accessibilityLabel={`Edit ${dish.name}`}
                      accessibilityRole="button"
                      className="flex-1"
                      onPress={() => router.push(`/dish-new?id=${dish._id}`)}
                      style={{ opacity: dish.isAvailable ? 1 : 0.55 }}
                    >
                      <View className="flex-row items-center gap-1.5">
                        {/* Same two colours the customer sees on the menu. */}
                        <VegMark color={dish.isVeg ? "#1fa85c" : "#c2410c"} size={12} />
                        <Text
                          className="flex-1 font-label text-body text-foreground"
                          numberOfLines={1}
                        >
                          {dish.name}
                        </Text>
                      </View>
                      <Text
                        className="font-sans text-caption text-text-muted"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {formatPrice(dish.price)}
                        {dish.isAvailable ? "" : " · switched off"}
                      </Text>
                    </Pressable>

                    <Switch
                      accessibilityLabel={`${dish.name} available`}
                      disabled={setAvailable.isPending}
                      onValueChange={(value) => void toggle(dish._id, value)}
                      value={dish.isAvailable}
                    />

                    <Pressable
                      accessibilityLabel={`Remove ${dish.name}`}
                      accessibilityRole="button"
                      className="h-10 w-9 items-center justify-center"
                      disabled={remove.isPending}
                      hitSlop={4}
                      onPress={() => confirmRemove(dish._id, dish.name)}
                    >
                      <Ionicons color={destructive as string} name="trash-outline" size={18} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
