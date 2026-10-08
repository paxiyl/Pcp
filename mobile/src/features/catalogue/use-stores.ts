import { useQuery } from "@tanstack/react-query";

import {
  getProductCategoriesQueryFn,
  getProductQueryFn,
  getProductsQueryFn,
  getStoreQueryFn,
  getStoresQueryFn,
} from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

type StoreFilters = {
  category?: string;
  storeType?: string;
  area?: string;
  search?: string;
};

/** "all" is a UI-only filter, so it is never sent to the API. */
const clean = <T extends Record<string, unknown>>(filters: T) =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== "all",
    ),
  ) as T;

export const useStores = (filters: StoreFilters = {}) => {
  const params = clean(filters);

  return useQuery({
    queryKey: queryKeys.stores(params),
    queryFn: () => getStoresQueryFn(params),
    select: (response) => response.data.stores,
  });
};

export const useStore = (slug: string) =>
  useQuery({
    queryKey: queryKeys.store(slug),
    queryFn: () => getStoreQueryFn(slug),
    enabled: Boolean(slug),
    select: (response) => response.data,
  });

type ProductFilters = {
  storeId?: string;
  categoryId?: string;
  category?: string;
  search?: string;
  brand?: string;
  sort?: "popular" | "price-asc" | "price-desc" | "discount" | "rating";
  inStockOnly?: boolean;
  /** Schedule H medicine cannot be bought in the app, so browse surfaces hide it. */
  excludePrescription?: boolean;
  page?: number;
  limit?: number;
};

export const useProducts = (filters: ProductFilters = {}, enabled = true) => {
  const params = clean(filters);

  return useQuery({
    queryKey: queryKeys.products(params),
    queryFn: () => getProductsQueryFn(params),
    enabled,
    select: (response) => response.data,
  });
};

export const useProduct = (id: string) =>
  useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => getProductQueryFn(id),
    enabled: Boolean(id),
    select: (response) => response.data,
  });

/**
 * The category tree. Cached longer than products because the taxonomy changes
 * when someone edits it in the admin, not when stock moves.
 */
export const useProductCategories = () =>
  useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: getProductCategoriesQueryFn,
    select: (response) => response.data.categories,
    staleTime: 5 * 60_000,
  });

/** Top-level categories only, for the home strip. */
export const useTopLevelCategories = () =>
  useQuery({
    queryKey: queryKeys.productCategories,
    queryFn: getProductCategoriesQueryFn,
    select: (response) => response.data.categories.filter((category) => !category.parentId),
    staleTime: 5 * 60_000,
  });
