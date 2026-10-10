import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./axios-client";

export const queryKeys = {
  accessToken: ["accessToken"] as const,
  addresses: ["addresses"] as const,
  basket: ["basket"] as const,
  banners: ["banners"] as const,
  categories: ["categories"] as const,
  dish: (id: string) => ["dish", id] as const,
  currentUser: ["currentUser"] as const,
  delivery: (id: string) => ["delivery", id] as const,
  driverHome: ["driverHome"] as const,
  order: (id: string) => ["order", id] as const,
  orders: ["orders"] as const,
  search: (term: string, mode: string) => ["search", mode, term] as const,
  paymentPreferences: ["paymentPreferences"] as const,
  imagePresets: ["imagePresets"] as const,
  authProviders: ["authProviders"] as const,
  restaurant: (slug: string) => ["restaurant", slug] as const,
  restaurants: (filters: { category?: string; search?: string } = {}) =>
    ["restaurants", filters] as const,
  product: (id: string) => ["product", id] as const,
  productCategories: ["productCategories"] as const,
  // The whole filter object is part of the key, so two rails on one screen with
  // different sorts never share a cache entry.
  products: (filters: Record<string, unknown> = {}) => ["products", filters] as const,
  store: (slug: string) => ["store", slug] as const,
  storeOverview: ["storeOverview"] as const,
  storeOrders: (status: string) => ["storeOrders", status] as const,
  storeProducts: (search: string) => ["storeProducts", search] as const,
  stores: (filters: Record<string, unknown> = {}) => ["stores", filters] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Mobile networks drop packets; retry transport failures, never a 4xx.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;

        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: { retry: false },
  },
});
