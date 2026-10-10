import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Screen } from "@/components/ui/screen";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useStoreOwnerProducts,
  useUpdateStoreStock,
} from "@/features/store-owner/use-store-owner";
import { formatPrice } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

/**
 * The shelf.
 *
 * Stock is edited with +/- buttons rather than a keyboard: a shopkeeper counting
 * packs with one hand is not going to type, and a stepper cannot produce the
 * kind of typo that lists 500 bags of atta.
 *
 * Price is read-only here on purpose — it is a commercial agreement, and a price
 * that can move from a phone can change a basket's total between a customer
 * adding an item and paying for it. Price edits stay in the backoffice.
 */
export default function StoreInventoryScreen() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [subtle, error, warning] = useCSSVariable([
    "--color-text-muted",
    "--color-error",
    "--color-warning",
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data: products, isLoading, isError, refetch } = useStoreOwnerProducts(
    debounced || undefined,
  );
  const update = useUpdateStoreStock();

  const change = async (productId: string, next: number) => {
    if (next < 0) return;

    haptics.selection();

    try {
      await update.mutateAsync({ productId, stock: next });
    } catch (err) {
      toast.error("Could not update stock", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const toggle = async (productId: string, isAvailable: boolean) => {
    try {
      await update.mutateAsync({ isAvailable, productId });
    } catch (err) {
      toast.error("Could not update that product", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <Screen edges={["top"]}>
      <View className="px-gutter pt-4">
        <Text accessibilityRole="header" className="font-title text-display text-foreground">
          Shelf
        </Text>
        <Text className="font-sans text-label text-text-secondary">
          Counts and listing. Prices are set by Raket.
        </Text>
      </View>

      <View className="px-gutter pt-4">
        <View className="h-13 flex-row items-center gap-3 rounded-input border border-border bg-surface px-4">
          <Ionicons color={subtle as string} name="search" size={20} />
          <TextInput
            accessibilityLabel="Search your shelf"
            autoCorrect={false}
            className="flex-1 font-sans text-body text-foreground"
            onChangeText={setSearch}
            placeholder="Search your products"
            placeholderTextColor={subtle as string}
            value={search}
          />
        </View>
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
            message="We could not load your shelf. Check your connection and try again."
            onRetry={() => void refetch()}
            title="Shelf unavailable"
          />
        ) : (products ?? []).length === 0 ? (
          <EmptyState
            icon="cube-outline"
            message={
              debounced
                ? `Nothing on your shelf matches "${debounced}".`
                : "Raket adds products to your shelf. Contact support to list something new."
            }
            title="Nothing here"
            {...(debounced ? { actionLabel: "Clear search", onAction: () => setSearch("") } : {})}
          />
        ) : (
          <View className="gap-2 px-gutter pt-4">
            {(products ?? []).map((product) => {
              const out = product.stock === 0;
              const low = !out && product.stock <= 5;

              return (
                <View className="gap-3 rounded-card bg-surface p-4" key={product._id}>
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-label text-body text-foreground" numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text className="font-sans text-caption text-text-muted">
                        {product.variantLabel
                          ? `${product.variantType}: ${product.variantLabel}`
                          : product.unit}{" "}
                        · {formatPrice(product.price)}
                      </Text>
                    </View>

                    <Switch
                      accessibilityLabel={`List ${product.name}`}
                      disabled={update.isPending}
                      onValueChange={(value) => void toggle(product._id, value)}
                      value={product.isAvailable}
                    />
                  </View>

                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-row items-center gap-1.5">
                      {out || low ? (
                        <Ionicons
                          color={(out ? error : warning) as string}
                          name="alert-circle"
                          size={14}
                        />
                      ) : null}
                      <Text
                        className={`font-label text-label ${
                          out ? "text-error" : low ? "text-warning" : "text-text-secondary"
                        }`}
                      >
                        {out ? "Out of stock" : low ? `Only ${product.stock} left` : "In stock"}
                      </Text>
                    </View>

                    <View className="h-10 flex-row items-center rounded-chip border border-border">
                      <Pressable
                        accessibilityLabel={`Reduce ${product.name}`}
                        accessibilityRole="button"
                        className="h-full w-11 items-center justify-center active:opacity-60"
                        disabled={out || update.isPending}
                        onPress={() => void change(product._id, product.stock - 1)}
                      >
                        <Ionicons
                          color={subtle as string}
                          name="remove"
                          size={18}
                          style={{ opacity: out ? 0.4 : 1 }}
                        />
                      </Pressable>

                      <Text
                        className="min-w-12 text-center font-title text-body text-foreground"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {product.stock}
                      </Text>

                      <Pressable
                        accessibilityLabel={`Add ${product.name}`}
                        accessibilityRole="button"
                        className="h-full w-11 items-center justify-center active:opacity-60"
                        disabled={update.isPending}
                        onPress={() => void change(product._id, product.stock + 1)}
                      >
                        <Ionicons color={subtle as string} name="add" size={18} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
