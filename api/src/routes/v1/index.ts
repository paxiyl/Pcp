import { Router } from "express";

import { addressRoutes } from "./address.route";
import { adminCategoryRoutes } from "./admin-category.route";
import { adminCustomerRoutes } from "./admin-customer.route";
import { adminOrderRoutes } from "./admin-order.route";
import { adminRestaurantRoutes } from "./admin-restaurant.route";
import { adminRiderRoutes } from "./admin-rider.route";
import { analyticsRoutes } from "./analytics.route";
import { authRoutes } from "./auth.route";
import { adminBannerRoutes, bannerRoutes } from "./banner.route";
import { basketRoutes } from "./basket.route";
import { categoryRoutes } from "./category.route";
import { driverRoutes } from "./driver.route";
import { imagePresetRoutes } from "./image-preset.route";
import { orderRoutes } from "./order.route";
import { paymentMethodRoutes } from "./payment-preference.route";
import { dishRoutes, restaurantRoutes } from "./restaurant.route";
import { adminDemandRoutes, searchRoutes } from "./search.route";
import { settingsRoutes } from "./settings.route";
import { adminStoreOwnerRoutes } from "./admin-store-owner.route";
import {
  adminApplicationRoutes,
  partnerApplicationRoutes,
} from "./partner-application.route";
import { restaurantOwnerRoutes } from "./restaurant-owner.route";
import { storeOwnerRoutes } from "./store-owner.route";
import {
  productCategoryRoutes,
  productRoutes,
  storeRoutes,
} from "./store.route";
import { uploadRoutes } from "./upload.route";

export const routes = Router();

routes.use("/auth", authRoutes);
routes.use("/addresses", addressRoutes);
routes.use("/banners", bannerRoutes);
routes.use("/categories", categoryRoutes);
routes.use("/basket", basketRoutes);
routes.use("/driver", driverRoutes);
routes.use("/image-presets", imagePresetRoutes);
routes.use("/orders", orderRoutes);
routes.use("/payment-methods", paymentMethodRoutes);
routes.use("/restaurants", restaurantRoutes);
routes.use("/dishes", dishRoutes);
routes.use("/admin/store-owners", adminStoreOwnerRoutes);
routes.use("/partner-applications", partnerApplicationRoutes);
routes.use("/admin/partner-applications", adminApplicationRoutes);
routes.use("/restaurant-owner", restaurantOwnerRoutes);
routes.use("/store-owner", storeOwnerRoutes);
routes.use("/stores", storeRoutes);
routes.use("/products", productRoutes);
routes.use("/product-categories", productCategoryRoutes);
routes.use("/search", searchRoutes);
routes.use("/admin/settings", settingsRoutes);
routes.use("/admin/analytics", analyticsRoutes);
routes.use("/admin/banners", adminBannerRoutes);
routes.use("/admin/categories", adminCategoryRoutes);
routes.use("/admin/demand", adminDemandRoutes);
routes.use("/admin/customers", adminCustomerRoutes);
routes.use("/admin/orders", adminOrderRoutes);
routes.use("/admin/restaurants", adminRestaurantRoutes);
routes.use("/admin/riders", adminRiderRoutes);
routes.use("/admin/uploads", uploadRoutes);
