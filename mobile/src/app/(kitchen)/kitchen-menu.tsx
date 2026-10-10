import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { CatalogueImage } from "@/components/catalogue-image";
import { VegMark } from "@/components/veg-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitchenDishes, useSetDishAvailable } from "@/features/kitchen/use-kitchen";
import { formatPrice } from "@/lib/format";
import { toast } from "@/lib/sonner";

/**
 * The menu, as a service-time control rather than an editor.
 *
 * One switch per dish, and nothing else. A kitchen mid-service needs exactly
 * one thing from its menu — "the paneer has run out, stop selling it" — and
 * putting price and description fields on the same screen is how someone
 * changes a price with floury hands at seven in the evening. The full edit
 * lives in the backoffice, which is the same split the shop's shelf uses.
 *
 * Sections are the kitchen's own, in menu order, because that is how they think
 * about their food and how the customer sees it.
 */
export default function KitchenMenuScreen() {
  const [search, setSearch] = useState("");
  const [subtle] = useCSSVariable(["--color-subtle-foreground"]);

  const { data: dishes, isLoading, isError, refetch } = useKitchenDishes();
  const setAvailable = useSetDishAvailable();

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

  return (
    <Screen edges={["top"]}>
      <View className="px-gutter pt-4">
        <Text accessibilityRole="header" className="font-title text-display text-foreground">
          Menu
        </Text>
        <Text className="font-sans text-label text-text-secondary">
          {offCount > 0
            ? `${offCount} switched off · customers cannot order ${offCount === 1 ? "it" : "them"}`
            : "Everything is on sale"}
        </Text>
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
                : "Your menu is empty. Dishes are added in the Raket backoffice — ask support and they will set it up with you."
            }
            title={term ? "No match" : "No dishes yet"}
            {...(term ? { actionLabel: "Clear search", onAction: () => setSearch("") } : {})}
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

                    <View className="flex-1" style={{ opacity: dish.isAvailable ? 1 : 0.55 }}>
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
                    </View>

                    <Switch
                      accessibilityLabel={`${dish.name} available`}
                      disabled={setAvailable.isPending}
                      onValueChange={(value) => void toggle(dish._id, value)}
                      value={dish.isAvailable}
                    />
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
