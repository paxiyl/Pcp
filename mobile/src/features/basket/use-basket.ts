import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addBasketItemMutationFn,
  addBasketProductMutationFn,
  clearBasketMutationFn,
  getBasketQueryFn,
  setBasketItemQuantityMutationFn,
  updateBasketMutationFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/**
 * The basket lives on the server so it survives reinstalls and follows the
 * customer between devices — and so totals are never computed on the client.
 */
export const useBasket = () =>
  useQuery({
    queryKey: queryKeys.basket,
    queryFn: getBasketQueryFn,
    select: (response) => response.data,
    // A basket is personal and changes often; do not serve it stale.
    staleTime: 0,
  });

/** Every mutation returns the whole basket, so the cache is replaced, not patched. */
const useBasketMutation = <TInput>(
  mutationFn: (input: TInput) => ReturnType<typeof getBasketQueryFn>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (response) => queryClient.setQueryData(queryKeys.basket, response),
  });
};

export const useAddBasketItem = () => useBasketMutation(addBasketItemMutationFn);
export const useAddBasketProduct = () => useBasketMutation(addBasketProductMutationFn);
export const useSetBasketItemQuantity = () => useBasketMutation(setBasketItemQuantityMutationFn);
export const useUpdateBasket = () => useBasketMutation(updateBasketMutationFn);
export const useClearBasket = () => useBasketMutation(() => clearBasketMutationFn());

/** Quantity of one product already in the basket, for the card's stepper. */
export const findProductLine = (
  items: { productId?: string; _id: string; quantity: number }[],
  productId: string,
) => items.find((item) => item.productId === productId);

/** Quantity of one dish+options+note combination already in the basket. */
export const findBasketLine = (
  items: { dishId?: string; optionNames: string[]; note?: string; _id: string; quantity: number }[],
  dishId: string,
  optionNames: string[],
  note?: string,
) => {
  const key = [dishId, [...optionNames].sort().join("|"), note?.trim() ?? ""].join("::");

  return items.find(
    (item) =>
      [item.dishId, [...item.optionNames].sort().join("|"), item.note?.trim() ?? ""].join("::") ===
      key,
  );
};
