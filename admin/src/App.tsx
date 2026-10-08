import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { AppLayout } from "@/layout/app-layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NoAccessPage } from "@/pages/auth/no-access-page";
import { SignInPage } from "@/pages/auth/sign-in-page";
import { BannersPage } from "@/pages/banners/banners-page";
import { CategoriesPage } from "@/pages/categories/categories-page";
import { CustomersPage } from "@/pages/customers/customers-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { OrderDetailPage } from "@/pages/orders/order-detail-page";
import { OrdersPage } from "@/pages/orders/orders-page";
import { RestaurantDetailPage } from "@/pages/restaurants/restaurant-detail-page";
import { RestaurantsPage } from "@/pages/restaurants/restaurants-page";
import { RidersPage } from "@/pages/riders/riders-page";
import { SettingsPage } from "@/pages/settings/settings-page";
import { StoreDetailPage } from "@/pages/stores/store-detail-page";
import { ProductCategoriesPage } from "@/pages/stores/product-categories-page";
import { StoreOwnersPage } from "@/pages/stores/store-owners-page";
import { StoresPage } from "@/pages/stores/stores-page";
import { ProtectedRoute } from "@/routes/protected-route";
import { PublicOnlyRoute } from "@/routes/public-only-route";
import { queryClient } from "@/lib/query-client";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Sidebar buttons render tooltips when collapsed, which need this. */}
      <TooltipProvider>
        <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<SignInPage />} />
          </Route>

          {/* Signed in but wrong role: reachable without being an admin. */}
          <Route path="/no-access" element={<NoAccessPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/banners" element={<BannersPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/restaurants" element={<RestaurantsPage />} />
              <Route path="/restaurants/:restaurantId" element={<RestaurantDetailPage />} />
              <Route path="/stores" element={<StoresPage />} />
              <Route path="/product-categories" element={<ProductCategoriesPage />} />
              <Route path="/store-owners" element={<StoreOwnersPage />} />
              <Route path="/stores/:storeSlug" element={<StoreDetailPage />} />
              <Route path="/riders" element={<RidersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>

      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
