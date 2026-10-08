import { ScrollView, View } from "react-native";

import type { Product } from "@/lib/api";
import {
  findProductLine,
  useAddBasketProduct,
  useBasket,
  useSetBasketItemQuantity,
} from "@/features/basket/use-basket";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

import { ProductCard } from "./product-card";
import { SectionHeader } from "./ui/section-header";

type Props = {
  title: string;
  subtitle?: string;
  products: Product[];
  onPressProduct: (productId: string) => void;
  onSeeAll?: () => void;
  cardWidth?: number;
};

/**
 * A horizontal shelf of products.
 *
 * Owns its own basket wiring rather than taking handlers from the screen, so a
 * home page with four rails does not have to thread four copies of the same
 * add/remove logic — and every rail in the app handles a stock rejection the
 * same way.
 */
export function ProductRail({
  title,
  subtitle,
  products,
  onPressProduct,
  onSeeAll,
  cardWidth = 150,
}: Props) {
  const { data } = useBasket();
  const addProduct = useAddBasketProduct();
  const setQuantity = useSetBasketItemQuantity();

  const items = data?.basket?.items ?? [];

  if (products.length === 0) return null;

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
      // Stock limits and the one-vendor rule are both enforced server-side, and
      // its message is the one that says what is actually wrong.
      toast.error("Could not update your basket", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  return (
    <View>
      <SectionHeader
        actionLabel={onSeeAll ? "See all" : undefined}
        onAction={onSeeAll}
        subtitle={subtitle}
        title={title}
      />

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {products.map((product) => {
          const quantity = findProductLine(items, product._id)?.quantity ?? 0;

          return (
            <ProductCard
              key={product._id}
              onAdd={() => void change(product._id, quantity + 1)}
              onPress={() => onPressProduct(product._id)}
              onRemove={() => void change(product._id, quantity - 1)}
              product={product}
              variantCount={product.variantCount}
              quantity={quantity}
              width={cardWidth}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
