import { API } from "./axios-client";

export type UserRole = "customer" | "driver" | "admin";

export type User = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthResponse = {
  message: string;
  data: { accessToken: string; user: User };
};

type CurrentUserResponse = { message: string; data: { user: User } };
type MessageResponse = { message: string };

/* Auth */

export const loginMutationFn = async (input: {
  email: string;
  password: string;
}): Promise<AuthResponse> => API.post("/auth/login", input);

export const logoutMutationFn = async (): Promise<MessageResponse> => API.post("/auth/logout");

export const getCurrentUserQueryFn = async (): Promise<CurrentUserResponse> => API.get("/auth/me");

/* Analytics */

export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type Totals = {
  orders: number;
  revenue: number;
  commission: number;
  riderPayouts: number;
  averageOrderValue: number;
};

export type RevenuePoint = { date: string; revenue: number; commission: number };
export type StatusCount = { status: OrderStatus; count: number };

export type RecentOrder = {
  _id: string;
  reference: string;
  contactName: string;
  restaurantName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
};

export type ActivityEvent = {
  orderId: string;
  reference: string;
  restaurantName: string;
  status: OrderStatus;
  note?: string;
  at: string;
};

export type Overview = {
  today: Totals;
  yesterday: Totals;
  series: RevenuePoint[];
  byStatus: StatusCount[];
  recent: RecentOrder[];
  activity: ActivityEvent[];
  liveOrders: number;
  /** Revenue split by where it came from: shops versus restaurants. */
  vendorSplit: VendorSplit[];
  /** How customers paid. The COD share is the cash riders are carrying. */
  paymentSplit: PaymentSplit[];
};

type OverviewResponse = { message: string; data: Overview };

export const getOverviewQueryFn = async (days: number): Promise<OverviewResponse> =>
  API.get("/admin/analytics/overview", { params: { days } });

/* Admin orders */

export type AdminOrderRow = {
  _id: string;
  reference: string;
  contactName: string;
  /**
   * The vendor snapshot, for both catalogues — a store order fills this with
   * the shop's name. The field name is historical.
   */
  restaurantName: string;
  /** Which catalogue the order came from. */
  vendorKind: "restaurant" | "store";
  paymentMethod: "upi" | "card" | "netbanking" | "wallet" | "cod";
  itemCount: number;
  total: number;
  /** What the restaurant earns: subtotal minus commission, in minor units. */
  restaurantPayout: number;
  status: OrderStatus;
  paidAt?: string;
  driverName?: string;
  createdAt: string;
};

export type AdminOrderStats = {
  ordersToday: number;
  awaitingAction: number;
  onDelivery: number;
  revenueToday: number;
};

export type AdminOrderList = {
  orders: AdminOrderRow[];
  total: number;
  page: number;
  pages: number;
  stats: AdminOrderStats;
};

export type AdminOrderFilters = {
  page: number;
  limit: number;
  search?: string;
  restaurantId?: string;
  status?: OrderStatus;
  range: "today" | "7d" | "30d" | "all";
};

type AdminOrderListResponse = { message: string; data: AdminOrderList };
type MessageOnlyResponse = { message: string };

export const getAdminOrdersQueryFn = async (
  filters: AdminOrderFilters,
): Promise<AdminOrderListResponse> => API.get("/admin/orders", { params: filters });

export const updateOrderStatusMutationFn = async ({
  orderId,
  status,
}: {
  orderId: string;
  status: "preparing" | "ready" | "cancelled";
}): Promise<MessageOnlyResponse> => API.patch(`/admin/orders/${orderId}/status`, { status });

/* Restaurants (reused for the orders filter) */

export type RestaurantOption = { _id: string; name: string; slug: string };

type RestaurantsResponse = { message: string; data: { restaurants: RestaurantOption[] } };

export const getRestaurantsQueryFn = async (): Promise<RestaurantsResponse> =>
  API.get("/restaurants");

export type AdminOrderItem = {
  _id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  optionNames: string[];
  note?: string;
};

export type AdminOrderStatusEntry = {
  _id: string;
  status: OrderStatus;
  at: string;
  note?: string;
};

export type AdminOrderDetail = {
  _id: string;
  reference: string;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  paymentMethod: "upi" | "card" | "netbanking" | "wallet" | "cod";
  /** Paise refunded so far. Partial refunds accumulate here. */
  refundedAmount?: number;
  refundedAt?: string;
  refundReason?: string;
  contactName: string;
  contactPhone?: string;
  restaurantName: string;
  restaurantAddress?: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    instructions?: string;
  };
  items: AdminOrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  commission: number;
  commissionRate: number;
  restaurantPayout: number;
  driver?: { name: string; phone?: string };
  driverPayout?: { base: number; distance: number; total: number; distanceKm: number };
  includeCutlery: boolean;
  orderNote?: string;
  statusHistory: AdminOrderStatusEntry[];
  estimatedDeliveryAt: string;
};

type AdminOrderDetailResponse = { message: string; data: { order: AdminOrderDetail } };

export const getAdminOrderQueryFn = async (id: string): Promise<AdminOrderDetailResponse> =>
  API.get(`/admin/orders/${id}`);

/** Frees a stranded order back to the open rider queue. */
export const releaseRiderMutationFn = async (orderId: string): Promise<MessageOnlyResponse> =>
  API.post(`/admin/orders/${orderId}/release-rider`);

/* Admin restaurants */

export type AdminRestaurantRow = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  address: string;
  cuisines: string[];
  isPureVeg: boolean;
  rating: number;
  ratingCount: number;
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  deliveryFee: number;
  minOrder: number;
  commissionRate?: number;
  description: string;
  closesAt: string;
  isOpen: boolean;
  freeDeliveryThreshold?: number;
  /** GeoJSON: coordinates are [longitude, latitude]. */
  location?: { type: "Point"; coordinates: [number, number] };
  isActive: boolean;
  ordersToday: number;
};

export type AdminRestaurantList = {
  restaurants: AdminRestaurantRow[];
  total: number;
  page: number;
  pages: number;
  stats: { total: number; active: number; inactive: number };
  cuisines: string[];
  isPureVeg: boolean;
  defaultCommissionRate: number;
};

export type AdminRestaurantFilters = {
  page: number;
  limit: number;
  search?: string;
  cuisine?: string;
  status?: "active" | "inactive";
};

/** Everything the create/edit form can set. Money is in minor units (cents). */
export type RestaurantInput = {
  name: string;
  description?: string;
  imageUrl?: string;
  address?: string;
  cuisines?: string[];
  isPureVeg?: boolean;
  prepTimeMinMinutes?: number;
  prepTimeMaxMinutes?: number;
  deliveryFee?: number;
  minOrder?: number;
  commissionRate?: number;
  closesAt?: string;
  isOpen?: boolean;
  isActive?: boolean;
  rating?: number;
  ratingCount?: number;
  freeDeliveryThreshold?: number;
  latitude?: number;
  longitude?: number;
};

type AdminRestaurantListResponse = { message: string; data: AdminRestaurantList };
type RestaurantMutationResponse = { message: string; data: { restaurant: AdminRestaurantRow } };

export const getAdminRestaurantsQueryFn = async (
  filters: AdminRestaurantFilters,
): Promise<AdminRestaurantListResponse> => API.get("/admin/restaurants", { params: filters });

export const createRestaurantMutationFn = async (
  input: RestaurantInput,
): Promise<RestaurantMutationResponse> => API.post("/restaurants", input);

export const updateRestaurantMutationFn = async ({
  id,
  ...input
}: Partial<RestaurantInput> & { id: string }): Promise<RestaurantMutationResponse> =>
  API.patch(`/restaurants/${id}`, input);

/* Uploads */

type UploadResponse = { message: string; data: { url: string; publicId: string } };

/** Posts the file to the API, which stores it and hands back a hosted URL. */
export const uploadImageMutationFn = async ({
  file,
  folder = "restaurants",
}: {
  file: File;
  folder?: string;
}): Promise<UploadResponse> => {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);

  return API.post("/admin/uploads/image", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

/* Restaurant detail and dishes */

export type AdminDishOption = {
  _id?: string;
  name: string;
  /** Minor units (cents), added to the dish's base price. */
  priceDelta: number;
  isDefault?: boolean;
};

export type AdminDishOptionGroup = {
  _id?: string;
  name: string;
  /** "single" renders radios in the app, "multiple" renders checkboxes. */
  type: "single" | "multiple";
  required: boolean;
  options: AdminDishOption[];
};

export type AdminDish = {
  _id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  section: string;
  /** The green-dot mark. The API refuses to create a dish without it. */
  isVeg: boolean;
  isAvailable: boolean;
  isPopular: boolean;
  optionGroups: AdminDishOptionGroup[];
  updatedAt: string;
};

/** The document itself: the same profile as a list row, minus today's count. */
export type AdminRestaurantProfile = Omit<AdminRestaurantRow, "ordersToday">;

export type AdminRestaurantDetail = {
  restaurant: AdminRestaurantProfile;
  dishes: AdminDish[];
  sections: string[];
  stats: { ordersToday: number; revenueToday: number; activeDishes: number };
  defaultCommissionRate: number;
};

export type DishInput = {
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  section?: string;
  /** Required, not optional: the API will not take a dish without it. */
  isVeg: boolean;
  isAvailable?: boolean;
  isPopular?: boolean;
  optionGroups?: AdminDishOptionGroup[];
};

type AdminRestaurantDetailResponse = { message: string; data: AdminRestaurantDetail };
type DishMutationResponse = { message: string; data: { dish: AdminDish } };

export const getAdminRestaurantQueryFn = async (
  id: string,
): Promise<AdminRestaurantDetailResponse> => API.get(`/admin/restaurants/${id}`);

export const createDishMutationFn = async ({
  restaurantId,
  ...input
}: DishInput & { restaurantId: string }): Promise<DishMutationResponse> =>
  API.post(`/restaurants/${restaurantId}/dishes`, input);

export const updateDishMutationFn = async ({
  id,
  ...input
}: Partial<DishInput> & { id: string }): Promise<DishMutationResponse> =>
  API.patch(`/dishes/${id}`, input);

export const deleteDishMutationFn = async (id: string): Promise<MessageOnlyResponse> =>
  API.delete(`/dishes/${id}`);

/* Categories — the platform-wide catalogue the mobile home strip uses. */

export type Category = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  isActive: boolean;
};

type CategoryListResponse = { message: string; data: { categories: Category[] } };

export const getCategoriesQueryFn = async (): Promise<CategoryListResponse> =>
  API.get("/categories");

/* Admin categories */

export type AdminCategory = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  backgroundColor: string;
  sortOrder: number;
  isActive: boolean;
  restaurantCount: number;
  dishCount: number;
};

export type AdminCategoryList = {
  categories: AdminCategory[];
  stats: { total: number; active: number };
};

/** Everything the create/edit dialog can set. */
export type CategoryInput = {
  name: string;
  slug?: string;
  imageUrl?: string;
  backgroundColor?: string;
  sortOrder?: number;
  isActive?: boolean;
};

type AdminCategoryListResponse = { message: string; data: AdminCategoryList };
type CategoryMutationResponse = { message: string; data: { category: AdminCategory } };

export const getAdminCategoriesQueryFn = async (): Promise<AdminCategoryListResponse> =>
  API.get("/admin/categories");

export const createCategoryMutationFn = async (
  input: CategoryInput,
): Promise<CategoryMutationResponse> => API.post("/categories", input);

export const updateCategoryMutationFn = async ({
  id,
  ...input
}: Partial<CategoryInput> & { id: string }): Promise<CategoryMutationResponse> =>
  API.patch(`/categories/${id}`, input);

export const reorderCategoriesMutationFn = async (
  categories: { id: string; sortOrder: number }[],
): Promise<MessageOnlyResponse> => API.patch("/admin/categories/reorder", { categories });

/* Admin riders */

export type DriverStatus = "pending" | "approved" | "suspended";

export type AdminRider = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  driverStatus: DriverStatus;
  isOnline: boolean;
  isActive: boolean;
  rating?: number;
  ratingCount?: number;
  deliveries: number;
  /** Minor units (cents) earned across delivered orders. */
  earnings: number;
  activeDeliveries: number;
  lastDeliveryAt?: string;
  createdAt: string;
};

export type AdminRiderList = {
  riders: AdminRider[];
  total: number;
  page: number;
  pages: number;
  stats: { total: number; online: number; pending: number; earningsToday: number };
};

export type AdminRiderFilters = {
  page: number;
  limit: number;
  search?: string;
  verification?: DriverStatus;
};

export type CreateRiderInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  driverStatus?: DriverStatus;
};

export type UpdateRiderInput = {
  name?: string;
  phone?: string;
  driverStatus?: DriverStatus;
  isActive?: boolean;
  rating?: number;
};

type AdminRiderListResponse = { message: string; data: AdminRiderList };
type RiderMutationResponse = { message: string; data: { rider: AdminRider } };

export const getAdminRidersQueryFn = async (
  filters: AdminRiderFilters,
): Promise<AdminRiderListResponse> => API.get("/admin/riders", { params: filters });

export const createRiderMutationFn = async (
  input: CreateRiderInput,
): Promise<RiderMutationResponse> => API.post("/admin/riders", input);

export const updateRiderMutationFn = async ({
  id,
  ...input
}: UpdateRiderInput & { id: string }): Promise<RiderMutationResponse> =>
  API.patch(`/admin/riders/${id}`, input);

/* Admin customers */

export type AdminCustomer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  orders: number;
  /** Minor units (cents) across paid orders. */
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
};

export type AdminCustomerList = {
  customers: AdminCustomer[];
  total: number;
  page: number;
  pages: number;
  stats: { total: number; activeThisMonth: number; newThisMonth: number };
};

export type AdminCustomerFilters = {
  page: number;
  limit: number;
  search?: string;
  status?: "active" | "suspended";
  sort: "joined" | "orders" | "spend";
};

type AdminCustomerListResponse = { message: string; data: AdminCustomerList };
type CustomerMutationResponse = { message: string; data: { customer: AdminCustomer } };

export const getAdminCustomersQueryFn = async (
  filters: AdminCustomerFilters,
): Promise<AdminCustomerListResponse> => API.get("/admin/customers", { params: filters });

export const updateCustomerMutationFn = async ({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}): Promise<CustomerMutationResponse> => API.patch(`/admin/customers/${id}`, { isActive });

/* Platform settings */

export type PlatformSettings = {
  driverBasePay: number;
  driverPayPerKm: number;
  restaurantCommissionRate: number;
  serviceFeeRate: number;
  /** Master switch for cash on delivery. */
  codEnabled: boolean;
  /** Largest order (paise) a rider may be asked to collect in cash. */
  codMaxOrderValue: number;
  /** How many unsettled COD orders one customer may have in flight. */
  codMaxOpenOrders: number;
  updatedAt: string;
};

export type SettingsInput = Partial<Omit<PlatformSettings, "updatedAt">>;

type SettingsResponse = { message: string; data: { settings: PlatformSettings } };

export const getSettingsQueryFn = async (): Promise<SettingsResponse> =>
  API.get("/admin/settings");

export const updateSettingsMutationFn = async (
  input: SettingsInput,
): Promise<SettingsResponse> => API.patch("/admin/settings", input);

/* Banners */

export type BannerState = "active" | "scheduled" | "expired" | "draft";

export type AdminBanner = {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  categorySlug?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  sortOrder: number;
  state: BannerState;
};

export type AdminBannerList = {
  banners: AdminBanner[];
  stats: { total: number; active: number; scheduled: number };
};

export type BannerInput = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  categorySlug?: string;
  /** ISO date, or "" to clear it. */
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
};

type AdminBannerListResponse = { message: string; data: AdminBannerList };
type BannerMutationResponse = { message: string; data: { banner: AdminBanner } };

export const getAdminBannersQueryFn = async (): Promise<AdminBannerListResponse> =>
  API.get("/admin/banners");

export const createBannerMutationFn = async (
  input: BannerInput,
): Promise<BannerMutationResponse> => API.post("/admin/banners", input);

export const updateBannerMutationFn = async ({
  id,
  ...input
}: Partial<BannerInput> & { id: string }): Promise<BannerMutationResponse> =>
  API.patch(`/admin/banners/${id}`, input);

export const deleteBannerMutationFn = async (id: string): Promise<MessageOnlyResponse> =>
  API.delete(`/admin/banners/${id}`);

export const reorderBannersMutationFn = async (
  banners: { id: string; sortOrder: number }[],
): Promise<MessageOnlyResponse> => API.patch("/admin/banners/reorder", { banners });

/* ---------------------------------------------------------------------------
 * Product catalogue: stores, products, product categories.
 *
 * These hit the SAME endpoints the mobile app browses (`/stores`, `/products`),
 * because reads are public and writes are already admin-guarded server-side.
 * There is no `/admin/stores` mirror to keep in sync with it.
 * ------------------------------------------------------------------------- */

export type AdminStore = {
  _id: string;
  name: string;
  slug: string;
  storeType: string;
  description: string;
  imageUrl: string;
  coverUrl: string;
  rating: number;
  ratingCount: number;
  etaMinutes: number;
  /** Minor units (paise). */
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold?: number;
  address: string;
  area: string;
  closesAt: string;
  isOpen: boolean;
  isActive: boolean;
  sortOrder: number;
  commissionRate?: number;
};

export type AdminProduct = {
  _id: string;
  storeId: string;
  storeName: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  unit: string;
  brand: string;
  categoryId: string | { _id: string; name: string; slug: string };
  price: number;
  mrp: number;
  rating: number;
  ratingCount: number;
  stock: number;
  maxPerOrder: number;
  isAvailable: boolean;
  isPopular: boolean;
  tags: string[];
  variantGroupId?: string;
  variantLabel?: string;
  variantType?: string;
  isDefaultVariant: boolean;
  variantCount?: number;
  requiresPrescription: boolean;
};

export type AdminProductCategory = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  backgroundColor: string;
  parentId?: string | null;
  productCount: number;
  sortOrder: number;
  isActive: boolean;
};

export type StoreInput = {
  name: string;
  storeType?: string;
  description?: string;
  imageUrl?: string;
  coverUrl?: string;
  etaMinutes?: number;
  deliveryFee?: number;
  minOrder?: number;
  freeDeliveryThreshold?: number;
  address?: string;
  area?: string;
  closesAt?: string;
  isOpen?: boolean;
  isActive?: boolean;
  commissionRate?: number;
};

export type ProductInput = {
  name: string;
  description?: string;
  imageUrl?: string;
  unit: string;
  brand?: string;
  categoryId: string;
  price: number;
  mrp?: number;
  stock?: number;
  maxPerOrder?: number;
  isAvailable?: boolean;
  isPopular?: boolean;
  tags?: string[];
  requiresPrescription?: boolean;
  variantLabel?: string;
  variantType?: string;
};

export type ProductFilters = {
  storeId?: string;
  categoryId?: string;
  search?: string;
  /** The admin wants every SKU; the storefront wants one card per article. */
  includeVariants?: boolean;
  page?: number;
  limit?: number;
};

type StoresResponse = { message: string; data: { stores: AdminStore[] } };
type StoreDetailResponse = {
  message: string;
  data: { store: AdminStore; products: AdminProduct[] };
};
type StoreMutationResponse = { message: string; data: { store: AdminStore } };
type ProductsResponse = {
  message: string;
  data: { products: AdminProduct[]; total: number; page: number; pages: number };
};
type ProductMutationResponse = { message: string; data: { product: AdminProduct } };
type ProductCategoriesResponse = {
  message: string;
  data: { categories: AdminProductCategory[] };
};

export const getStoresQueryFn = async (params?: {
  search?: string;
  storeType?: string;
}): Promise<StoresResponse> => API.get("/stores", { params });

export const getStoreQueryFn = async (slug: string): Promise<StoreDetailResponse> =>
  API.get(`/stores/${slug}`);

export const createStoreMutationFn = async (
  input: StoreInput,
): Promise<StoreMutationResponse> => API.post("/stores", input);

export const updateStoreMutationFn = async ({
  id,
  ...input
}: Partial<StoreInput> & { id: string }): Promise<StoreMutationResponse> =>
  API.patch(`/stores/${id}`, input);

export const deleteStoreMutationFn = async (id: string): Promise<MessageResponse> =>
  API.delete(`/stores/${id}`);

export const getProductsQueryFn = async (
  filters: ProductFilters,
): Promise<ProductsResponse> => API.get("/products", { params: filters });

export const createProductMutationFn = async ({
  storeId,
  ...input
}: ProductInput & { storeId: string }): Promise<ProductMutationResponse> =>
  API.post(`/stores/${storeId}/products`, input);

export const updateProductMutationFn = async ({
  id,
  ...input
}: Partial<ProductInput> & { id: string }): Promise<ProductMutationResponse> =>
  API.patch(`/products/${id}`, input);

export const deleteProductMutationFn = async (id: string): Promise<MessageResponse> =>
  API.delete(`/products/${id}`);

export const getProductCategoriesQueryFn = async (): Promise<ProductCategoriesResponse> =>
  API.get("/product-categories");

/* ---------------------------------------------------------------------------
 * Store owners: the accounts that run each shop.
 * ------------------------------------------------------------------------- */

export type StoreOwnerRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  /** Null when an account exists but has not been attached to a shop. */
  store: { _id: string; name: string; slug: string } | null;
};

export type CreateStoreOwnerInput = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  storeId: string;
};

export type UpdateStoreOwnerInput = {
  name?: string;
  phone?: string;
  isActive?: boolean;
  storeId?: string;
};

type StoreOwnersResponse = {
  message: string;
  data: { owners: StoreOwnerRow[]; total: number };
};
type StoreOwnerMutationResponse = { message: string; data: { owner: StoreOwnerRow } };

export const getStoreOwnersQueryFn = async (params?: {
  search?: string;
}): Promise<StoreOwnersResponse> => API.get("/admin/store-owners", { params });

export const createStoreOwnerMutationFn = async (
  input: CreateStoreOwnerInput,
): Promise<StoreOwnerMutationResponse> => API.post("/admin/store-owners", input);

export const updateStoreOwnerMutationFn = async ({
  ownerId,
  ...input
}: UpdateStoreOwnerInput & { ownerId: string }): Promise<StoreOwnerMutationResponse> =>
  API.patch(`/admin/store-owners/${ownerId}`, input);

export const deactivateStoreOwnerMutationFn = async (
  ownerId: string,
): Promise<MessageResponse> => API.delete(`/admin/store-owners/${ownerId}`);

/* Product categories (the grocery taxonomy, separate from restaurant cuisines) */

export type ProductCategoryInput = {
  name: string;
  imageUrl?: string;
  backgroundColor?: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

type ProductCategoryMutationResponse = {
  message: string;
  data: { category: AdminProductCategory };
};

export const createProductCategoryMutationFn = async (
  input: ProductCategoryInput,
): Promise<ProductCategoryMutationResponse> => API.post("/product-categories", input);

export const updateProductCategoryMutationFn = async ({
  id,
  ...input
}: ProductCategoryInput & { id: string }): Promise<ProductCategoryMutationResponse> =>
  API.patch(`/product-categories/${id}`, input);

export const deleteProductCategoryMutationFn = async (id: string): Promise<MessageResponse> =>
  API.delete(`/product-categories/${id}`);

/* Refunds */

export type RefundOrderInput = {
  /** Paise. Omit for the whole unrefunded balance. */
  amount?: number;
  reason: string;
};

export const refundOrderMutationFn = async ({
  orderId,
  ...input
}: RefundOrderInput & { orderId: string }): Promise<{ message: string }> =>
  API.post(`/admin/orders/${orderId}/refund`, input);

/* Analytics splits */

export type VendorSplit = {
  vendorKind: "restaurant" | "store";
  orders: number;
  revenue: number;
  commission: number;
};

export type PaymentSplit = { paymentMethod: string; orders: number; revenue: number };

/* Partner applications */

export type PartnerRole = "store_owner" | "restaurant_owner" | "driver";
export type ApplicationStatus = "pending" | "approved" | "rejected";

/** `userId` arrives populated with the applicant's contact details. */
export type ApplicationApplicant = { _id: string; name: string; email: string; phone?: string };

export type PartnerApplication = {
  _id: string;
  userId: ApplicationApplicant | string;
  requestedRole: PartnerRole;
  status: ApplicationStatus;
  businessName?: string;
  area?: string;
  phone: string;
  vehicle?: string;
  note?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
};

type ApplicationsResponse = { message: string; data: { applications: PartnerApplication[] } };

export const getApplicationsQueryFn = async (
  status?: ApplicationStatus,
): Promise<ApplicationsResponse> =>
  API.get("/admin/partner-applications", { params: status ? { status } : undefined });

export const reviewApplicationMutationFn = async (input: {
  applicationId: string;
  status: "approved" | "rejected";
  reviewNote?: string;
}): Promise<{ message: string; data: { application: PartnerApplication } }> =>
  API.patch(`/admin/partner-applications/${input.applicationId}`, {
    reviewNote: input.reviewNote,
    status: input.status,
  });

/* Google sign-in */

type AuthProvidersResponse = { message: string; data: { google: boolean } };

export const getAuthProvidersQueryFn = async (): Promise<AuthProvidersResponse> =>
  API.get("/auth/providers");

export const googleSignInMutationFn = async (idToken: string): Promise<AuthResponse> =>
  API.post("/auth/google", { idToken });
