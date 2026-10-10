import { API } from "./axios-client";

/**
 * Every call the app makes to the Raket API lives here, one function per
 * endpoint. Screens pass these straight to TanStack Query:
 *
 *   useMutation({ mutationFn: loginMutationFn })
 *   useQuery({ queryKey: ["currentUser"], queryFn: getCurrentUserQueryFn })
 */

/**
 * Every role the API can put on an account. `restaurant_owner` was missing
 * here, which is how a kitchen owner ended up with no screens: the type said
 * the role could not exist, so nothing was ever written to handle it.
 */
export type UserRole =
  | "customer"
  | "driver"
  | "store_owner"
  | "restaurant_owner"
  | "admin";

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

export type AddressLabel = "Home" | "Work" | "Other";

export type Address = {
  _id: string;
  userId: string;
  label: AddressLabel;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  instructions?: string;
  location?: { type: "Point"; coordinates: [number, number] };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  /** Tint behind the category image on the home strip. */
  backgroundColor: string;
  sortOrder: number;
  isActive: boolean;
};

export type Restaurant = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  cuisines: string[];
  /** A kitchen that serves no meat at all. Drives the badge and the veg filter. */
  isPureVeg: boolean;
  categories: { _id: string; name: string; slug: string }[];
  rating: number;
  ratingCount: number;
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  /** Minor units (cents). */
  deliveryFee: number;
  minOrder: number;
  address: string;
  /** 24-hour "HH:mm". */
  closesAt: string;
  isOpen: boolean;
};

export type DishOption = {
  _id: string;
  name: string;
  /** Minor units (cents) added to the dish base price. */
  priceDelta: number;
  isDefault: boolean;
};

export type DishOptionGroup = {
  _id: string;
  name: string;
  /** "single" renders radios, "multiple" renders checkboxes. */
  type: "single" | "multiple";
  required: boolean;
  options: DishOption[];
};

export type Dish = {
  _id: string;
  restaurantId: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Set when the owner picked a stand-in tile rather than uploading a photo. */
  imagePreset?: string;
  /** Minor units (cents). */
  price: number;
  calories?: number;
  allergens: string[];
  optionGroups: DishOptionGroup[];
  section: string;
  /** The green-dot mark. Never assumed — the API only sets it when someone said so. */
  isVeg: boolean;
  isPopular: boolean;
  isAvailable: boolean;
};

type AuthResponse = {
  message: string;
  data: {
    accessToken: string;
    hasAddress: boolean;
    defaultAddress: Address | null;
    user: User;
    /** Present when they signed up as a shop, a kitchen or a rider. */
    application?: PartnerApplication;
  };
};
type UserResponse = {
  message: string;
  data: {
    hasAddress: boolean;
    defaultAddress: Address | null;
    user: User;
    /** The account's latest partner application, if it ever filed one. */
    application?: PartnerApplication | null;
  };
};
type CategoriesResponse = { message: string; data: { categories: Category[] } };

export type Banner = {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  /** The category the home screen filters to when the banner is tapped. */
  categorySlug?: string;
};

type BannersResponse = { message: string; data: { banners: Banner[] } };
type RestaurantsResponse = { message: string; data: { restaurants: Restaurant[] } };
type RestaurantResponse = {
  message: string;
  data: { restaurant: Restaurant; dishes: Dish[] };
};
type DishResponse = { message: string; data: { dish: Dish; restaurant: Restaurant } };
/** Search returns dishes with their restaurant populated for context. */
export type SearchDish = Omit<Dish, "restaurantId"> & {
  restaurantId: { _id: string; name: string; slug: string };
};

type SearchResponse = {
  message: string;
  data: {
    query: string;
    /** Listed first in the UI: packaged goods are what most searches are for. */
    products: Product[];
    stores: Store[];
    restaurants: Restaurant[];
    dishes: SearchDish[];
  };
};
/* Product catalogue (stores). Shapes mirror api/src/models/*.model.ts. */

export type Store = {
  _id: string;
  name: string;
  slug: string;
  storeType: string;
  description: string;
  imageUrl: string;
  coverUrl: string;
  categories: { _id: string; name: string; slug: string }[];
  rating: number;
  ratingCount: number;
  /** Quick commerce promises one number, not a range. */
  etaMinutes: number;
  /** Minor units (paise). */
  deliveryFee: number;
  minOrder: number;
  freeDeliveryThreshold?: number;
  address: string;
  area: string;
  closesAt: string;
  isOpen: boolean;
};

export type ProductCategory = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  backgroundColor: string;
  parentId?: string | null;
  /** Includes sub-category totals, so a parent tile never reads 0. */
  productCount: number;
  sortOrder: number;
  isActive: boolean;
};

export type Product = {
  _id: string;
  storeId: string;
  storeName: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  /** Set when the owner picked a stand-in tile rather than uploading a photo. */
  imagePreset?: string;
  /** Pack size as printed: "1 kg", "500 ml". */
  unit: string;
  brand: string;
  categoryId: string | { _id: string; name: string; slug: string };
  /** Minor units (paise). What the customer pays. */
  price: number;
  /** Printed MRP. Equal to price when there is no discount. */
  mrp: number;
  rating: number;
  ratingCount: number;
  stock: number;
  maxPerOrder: number;
  isAvailable: boolean;
  isPopular: boolean;
  tags: string[];

  /**
   * Shared by every SKU of the same article — sizes of a shirt, shades of a
   * lipstick. Absent for most of a grocery catalogue. Listings return one row
   * per group; the detail screen gets the siblings.
   */
  variantGroupId?: string;
  /** "M", "Blue", "Shade 04". */
  variantLabel?: string;
  /** "Size", "Colour", "Shade", "Pack". */
  variantType?: string;
  isDefaultVariant: boolean;
  /** How many SKUs this article has. Present only when more than one. */
  variantCount?: number;
  /** Schedule H medicine. The API refuses to basket these. */
  requiresPrescription: boolean;
};

type StoresResponse = { message: string; data: { stores: Store[] } };
type StoreResponse = { message: string; data: { store: Store; products: Product[] } };
type ProductsResponse = {
  message: string;
  data: { products: Product[]; total: number; page: number; pages: number };
};
type ProductResponse = {
  message: string;
  data: { product: Product; store: Store | null; variants: Product[] };
};
type ProductCategoriesResponse = { message: string; data: { categories: ProductCategory[] } };

export type VendorKind = "restaurant" | "store";

export type BasketItem = {
  _id: string;
  /** Present on a restaurant line. Exactly one of dishId/productId is set. */
  dishId?: string;
  /** Present on a store line. */
  productId?: string;
  name: string;
  imageUrl: string;
  /** Set when the owner picked a stand-in tile rather than uploading a photo. */
  imagePreset?: string;
  /** Minor units (paise), priced by the server. */
  unitPrice: number;
  /** Printed MRP, for the struck-through price. Store lines only. */
  mrp?: number;
  /** Pack size as printed. Store lines only. */
  unit?: string;
  quantity: number;
  optionNames: string[];
  note?: string;
};

export type Basket = {
  _id: string;
  vendorKind: VendorKind;
  restaurantId?: string;
  storeId?: string;
  items: BasketItem[];
  includeCutlery: boolean;
  orderNote: string;
};

/** Enough to render the basket header without knowing which catalogue it is. */
export type VendorSummary = {
  kind: VendorKind;
  id: string;
  name: string;
  imageUrl: string;
  etaMinutes: number;
  isOpen: boolean;
};

/** Every figure here is computed server-side; the client never sums prices. */
export type BasketTotals = {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  itemCount: number;
  minOrder: number;
  belowMinimum: boolean;
  freeDeliveryThreshold: number | null;
  amountToFreeDelivery: number | null;
  /** Printed MRP minus what is charged, in paise. 0 for a restaurant basket. */
  savings: number;
};

/** Which payment methods this basket may actually use, decided server-side. */
export type BasketPaymentOptions = {
  codAvailable: boolean;
  codMaxOrderValue: number;
  /** Shown beside a disabled cash option. Absent when it is available. */
  codUnavailableReason?: string;
};

type BasketResponse = {
  message: string;
  data: {
    payment: BasketPaymentOptions;
    basket: Basket | null;
    /** Null for a store basket — read `vendor`, which is set for both. */
    restaurant: Restaurant | null;
    store: Store | null;
    vendor: VendorSummary | null;
    totals: BasketTotals;
  };
};
export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  _id: string;
  dishId: string;
  name: string;
  imageUrl: string;
  /** Set when the owner picked a stand-in tile rather than uploading a photo. */
  imagePreset?: string;
  unitPrice: number;
  quantity: number;
  optionIds: string[];
  optionNames: string[];
  note?: string;
};

export type OrderStatusEntry = {
  _id: string;
  status: OrderStatus;
  at: string;
  note?: string;
};

/** Plain lat/lng snapshot stored on the order for the tracking map. */
export type OrderPoint = { lat: number; lng: number };

export type OrderDriver = {
  driverId?: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  location?: OrderPoint;
  locationUpdatedAt?: string;
};

export type Order = {
  _id: string;
  reference: string;
  /**
   * The denormalised VENDOR snapshot, for both catalogues — a store order fills
   * these with the shop's name, image and address. The names are historical.
   */
  vendorKind: VendorKind;
  restaurantId?: string;
  storeId?: string;
  restaurantName: string;
  restaurantImageUrl: string;
  restaurantAddress?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  currency: string;
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
    instructions?: string;
  };
  contactName: string;
  contactPhone?: string;
  restaurantLocation?: OrderPoint;
  deliveryLocation?: OrderPoint;
  /** Absent until a rider accepts the order. */
  driver?: OrderDriver;
  includeCutlery: boolean;
  orderNote?: string;
  prepTimeMinMinutes: number;
  prepTimeMaxMinutes: number;
  estimatedDeliveryAt: string;
  status: OrderStatus;
  statusHistory: OrderStatusEntry[];
  paymentMethod: PaymentMethod;
  paymentProvider: "razorpay" | "stripe" | "cod";
  /** Cash still owed at the door, in paise. Unset for a prepaid order. */
  codAmountDue?: number;
  /** Set the moment the rider takes the cash. */
  codCollectedAt?: string;
  /** Only ever returned to the customer who owns the order. */
  deliveryCode?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cod";

/** What the client needs to open a payment sheet. Null for cash on delivery. */
export type CheckoutSession = {
  provider: "razorpay" | "stripe" | "cod";
  /** Razorpay order id. Pass this to the checkout sheet. */
  providerOrderId?: string;
  /** Stripe only. */
  clientSecret?: string;
  publicKey: string;
  amount: number;
  currency: string;
};

type CheckoutResponse = {
  message: string;
  data: { order: Order; checkout: CheckoutSession | null };
};
type OrdersResponse = { message: string; data: { orders: Order[] } };

/** Rider pay for one delivery, computed and snapshotted by the server. */
export type DeliveryPayout = {
  base: number;
  distance: number;
  total: number;
  distanceKm: number;
};

export type Delivery = { order: Order; payout: DeliveryPayout };

export type DriverSummary = {
  deliveries: number;
  earnings: number;
  isOnline: boolean;
  /**
   * Cash this rider is holding that belongs to the office, less the earnings
   * they keep out of it. Negative means the office owes them.
   */
  cashToHandOver: number;
  unsettledDeliveries: number;
};

type DriverHomeResponse = {
  message: string;
  data: { active: Delivery[]; ready: Delivery[]; summary: DriverSummary };
};
type DeliveryResponse = { message: string; data: Delivery };
type OnlineResponse = { message: string; data: { isOnline: boolean } };
type ReorderResponse = { message: string; data: { added: number; skipped: string[] } };
type OrderResponse = { message: string; data: { order: Order } };

type AddressesResponse = { message: string; data: { addresses: Address[] } };
type AddressResponse = { message: string; data: { address: Address } };
type MessageResponse = { message: string };

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  /**
   * What they are signing up to BE, sent WITH the registration.
   *
   * It was a second request, which meant a failure there left someone an
   * ordinary customer with no application and nothing on screen saying so.
   * The account created is still always a customer — this files the request an
   * admin decides on.
   */
  joinAs?: PartnerRole;
  businessName?: string;
  area?: string;
  vehicle?: string;
};

/** The four experiences the one app serves. Admins sign in on the backoffice. */
export type AppRole = "customer" | "driver" | "store_owner" | "restaurant_owner";

export type LoginInput = {
  email: string;
  password: string;
  /**
   * The experience picked at sign-in. A hint the server VERIFIES against the
   * account's stored role — it never grants one.
   */
  intendedRole?: AppRole;
};

export type AddressInput = {
  label: AddressLabel;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  instructions?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
};

/* Auth */

export const registerMutationFn = async (input: RegisterInput): Promise<AuthResponse> =>
  API.post("/auth/register", input);

/**
 * Trades a Google ID token for one of our sessions.
 *
 * `intendedRole` only chooses which experience to open, exactly as on a
 * password login — the server decides the actual role, and a brand-new Google
 * account is always a customer.
 */
export const googleSignInMutationFn = async (input: {
  idToken: string;
  intendedRole?: AppRole;
}): Promise<AuthResponse> => API.post("/auth/google", input);

type AuthProvidersResponse = { message: string; data: { google: boolean } };

/** Lets the app hide the Google button rather than offer one that cannot work. */
export const getAuthProvidersQueryFn = async (): Promise<AuthProvidersResponse> =>
  API.get("/auth/providers");

/* Store owner */

export type StoreOwnerOverview = {
  store: Store;
  openOrders: Order[];
  today: { orders: number; revenue: number };
  lowStock: Product[];
  outOfStock: number;
};

type StoreOwnerOverviewResponse = { message: string; data: StoreOwnerOverview };
type StoreOwnerOrdersResponse = { message: string; data: { orders: Order[] } };
type StoreOwnerProductsResponse = { message: string; data: { products: Product[] } };
type StoreOwnerStoreResponse = { message: string; data: { store: Store } };

export const getStoreOverviewQueryFn = async (): Promise<StoreOwnerOverviewResponse> =>
  API.get("/store-owner/overview");

export const getStoreOwnerOrdersQueryFn = async (status?: string): Promise<StoreOwnerOrdersResponse> =>
  API.get("/store-owner/orders", { params: status ? { status } : undefined });

/** Only "preparing" and "ready": dispatch belongs to the rider. */
export const advanceStoreOrderMutationFn = async ({
  orderId,
  status,
}: {
  orderId: string;
  status: "preparing" | "ready";
}): Promise<OrderResponse> => API.patch(`/store-owner/orders/${orderId}`, { status });

export const getStoreOwnerProductsQueryFn = async (
  search?: string,
): Promise<StoreOwnerProductsResponse> =>
  API.get("/store-owner/products", { params: search ? { search } : undefined });

/** Stock and listing only. Price edits stay in the backoffice. */
export const updateStoreStockMutationFn = async ({
  productId,
  ...input
}: {
  productId: string;
  stock?: number;
  isAvailable?: boolean;
}): Promise<{ message: string; data: { product: Product } }> =>
  API.patch(`/store-owner/products/${productId}`, input);

export const setStoreOpenMutationFn = async (
  isOpen: boolean,
): Promise<StoreOwnerStoreResponse> => API.patch("/store-owner/open", { isOpen });

/* Kitchen owner — the counterpart of the shop counter above */

export type RestaurantOwnerOverview = {
  restaurant: Restaurant;
  openOrders: Order[];
  today: { orders: number; revenue: number };
  /** Dishes the kitchen has switched off, usually because they ran out. */
  unavailable: number;
};

type RestaurantOverviewResponse = { message: string; data: RestaurantOwnerOverview };
type RestaurantOwnerDishesResponse = { message: string; data: { dishes: Dish[] } };
type RestaurantOwnerRestaurantResponse = { message: string; data: { restaurant: Restaurant } };

export const getKitchenOverviewQueryFn = async (): Promise<RestaurantOverviewResponse> =>
  API.get("/restaurant-owner/overview");

export const getKitchenDishesQueryFn = async (): Promise<RestaurantOwnerDishesResponse> =>
  API.get("/restaurant-owner/dishes");

type KitchenOrdersResponse = { message: string; data: { orders: Order[] } };

export const getKitchenOrdersQueryFn = async (
  status?: string,
): Promise<KitchenOrdersResponse> =>
  API.get("/restaurant-owner/orders", { params: status ? { status } : undefined });

/** Only "preparing" and "ready": dispatch belongs to the rider. */
export const advanceKitchenOrderMutationFn = async ({
  orderId,
  status,
}: {
  orderId: string;
  status: "preparing" | "ready";
}): Promise<OrderResponse> =>
  API.patch(`/restaurant-owner/orders/${orderId}`, { status });

/**
 * Switching a dish on or off is the edit a kitchen makes during service, when
 * something runs out. Everything else about a dish is edited in the backoffice.
 */
export const setDishAvailableMutationFn = async ({
  dishId,
  isAvailable,
}: {
  dishId: string;
  isAvailable: boolean;
}): Promise<{ message: string; data: { dish: Dish } }> =>
  API.put(`/restaurant-owner/dishes/${dishId}`, { isAvailable });

export const setKitchenOpenMutationFn = async (
  isOpen: boolean,
): Promise<RestaurantOwnerRestaurantResponse> =>
  API.patch("/restaurant-owner/open", { isOpen });

export const loginMutationFn = async (input: LoginInput): Promise<AuthResponse> =>
  API.post("/auth/login", input);

export const logoutMutationFn = async (): Promise<MessageResponse> => API.post("/auth/logout");

export const getCurrentUserQueryFn = async (): Promise<UserResponse> => API.get("/auth/me");

/* Addresses */

export const getAddressesQueryFn = async (): Promise<AddressesResponse> => API.get("/addresses");

export const createAddressMutationFn = async (input: AddressInput): Promise<AddressResponse> =>
  API.post("/addresses", input);

export const updateAddressMutationFn = async ({
  id,
  ...input
}: AddressInput & { id: string }): Promise<AddressResponse> => API.patch(`/addresses/${id}`, input);

export const setDefaultAddressMutationFn = async (id: string): Promise<AddressResponse> =>
  API.patch(`/addresses/${id}/default`);

export const deleteAddressMutationFn = async (id: string): Promise<MessageResponse> =>
  API.delete(`/addresses/${id}`);

/* Catalogue */

export const getCategoriesQueryFn = async (): Promise<CategoriesResponse> => API.get("/categories");

/** Only the banners that are live right now; the admin owns the schedule. */
export const getBannersQueryFn = async (): Promise<BannersResponse> => API.get("/banners/active");

export const getRestaurantsQueryFn = async (params?: {
  category?: string;
  search?: string;
  veg?: boolean;
}): Promise<RestaurantsResponse> => API.get("/restaurants", { params });

export const getRestaurantQueryFn = async (slug: string): Promise<RestaurantResponse> =>
  API.get(`/restaurants/${slug}`);

export const getDishQueryFn = async (id: string): Promise<DishResponse> => API.get(`/dishes/${id}`);

export const searchQueryFn = async (
  q: string,
  mode?: DeliveryCatalogue,
): Promise<SearchResponse> => API.get("/search", { params: { mode, q } });

/** Which half of the catalogue a search came from. */
export type DeliveryCatalogue = "grocery" | "food";

export type RequestItemResponse = {
  message: string;
  data: { term: string; mode: DeliveryCatalogue };
};

/**
 * "We do not sell that yet — do you want us to?" Recorded so the operator can
 * see what Hindaun keeps asking for and stock it, rather than the app
 * apologising into the void.
 */
export const requestItemMutationFn = async (input: {
  term: string;
  mode: DeliveryCatalogue;
}): Promise<RequestItemResponse> => API.post("/search/requests", input);

/* Product catalogue */

export const getStoresQueryFn = async (params?: {
  category?: string;
  storeType?: string;
  area?: string;
  search?: string;
}): Promise<StoresResponse> => API.get("/stores", { params });

export const getStoreQueryFn = async (slug: string): Promise<StoreResponse> =>
  API.get(`/stores/${slug}`);

export const getProductsQueryFn = async (params?: {
  storeId?: string;
  categoryId?: string;
  category?: string;
  search?: string;
  brand?: string;
  sort?: "popular" | "price-asc" | "price-desc" | "discount" | "rating";
  inStockOnly?: boolean;
  /** Hides prescription-only medicine from a general browse. */
  excludePrescription?: boolean;
  page?: number;
  limit?: number;
}): Promise<ProductsResponse> => API.get("/products", { params });

export const getProductQueryFn = async (id: string): Promise<ProductResponse> =>
  API.get(`/products/${id}`);

export const getProductCategoriesQueryFn = async (): Promise<ProductCategoriesResponse> =>
  API.get("/product-categories");

/* Basket */

export const getBasketQueryFn = async (): Promise<BasketResponse> => API.get("/basket");

export const addBasketItemMutationFn = async (input: {
  dishId: string;
  optionIds?: string[];
  quantity?: number;
  note?: string;
}): Promise<BasketResponse> => API.post("/basket/items", input);

/**
 * A product has no options and no note, so this is a separate endpoint rather
 * than a wider body on /basket/items. Stock is enforced server-side: a 400 here
 * means the shelf cannot cover the request, and the message is safe to show.
 */
export const addBasketProductMutationFn = async (input: {
  productId: string;
  quantity?: number;
}): Promise<BasketResponse> => API.post("/basket/products", input);

export const setBasketItemQuantityMutationFn = async ({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}): Promise<BasketResponse> => API.patch(`/basket/items/${itemId}`, { quantity });

export const updateBasketMutationFn = async (input: {
  includeCutlery?: boolean;
  orderNote?: string;
}): Promise<BasketResponse> => API.patch("/basket", input);

export const clearBasketMutationFn = async (): Promise<BasketResponse> => API.delete("/basket");

/* Orders and payment */

/**
 * Creates the order and opens a payment session for it.
 *
 * `checkout` comes back null for cash on delivery: the order is already
 * confirmed and the client should go straight to tracking rather than opening
 * a sheet.
 */
export const createOrderMutationFn = async (input: {
  addressId?: string;
  contactPhone?: string;
  deliveryInstructions?: string;
  paymentMethod?: PaymentMethod;
}): Promise<CheckoutResponse> => API.post("/orders", input);

/**
 * Hands the Razorpay callback back to the server for verification. The server
 * checks the signature AND re-reads the payment from Razorpay, so a client can
 * never talk its own order into being paid.
 */
export const verifyPaymentMutationFn = async ({
  orderId,
  ...input
}: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<OrderResponse> => API.post(`/orders/${orderId}/verify-payment`, input);

export const getOrdersQueryFn = async (): Promise<OrdersResponse> => API.get("/orders");

export const getOrderQueryFn = async (id: string): Promise<OrderResponse> => API.get(`/orders/${id}`);

/** Asks the server to re-read the payment from the gateway; the client never asserts it. */
export const syncOrderMutationFn = async (id: string): Promise<OrderResponse> =>
  API.post(`/orders/${id}/sync`);

/** Refills the basket from a past order; the server re-prices every dish. */
export const reorderMutationFn = async (id: string): Promise<ReorderResponse> =>
  API.post(`/orders/${id}/reorder`);

/* Driver */

export const getDriverHomeQueryFn = async (): Promise<DriverHomeResponse> =>
  API.get("/driver/home");

export const getDeliveryQueryFn = async (id: string): Promise<DeliveryResponse> =>
  API.get(`/driver/deliveries/${id}`);

export const claimDeliveryMutationFn = async (id: string): Promise<DeliveryResponse> =>
  API.post(`/driver/deliveries/${id}/claim`);

export const pickUpDeliveryMutationFn = async (id: string): Promise<DeliveryResponse> =>
  API.post(`/driver/deliveries/${id}/pick-up`);

export const completeDeliveryMutationFn = async ({
  code,
  id,
}: {
  code: string;
  id: string;
}): Promise<DeliveryResponse> => API.post(`/driver/deliveries/${id}/complete`, { code });

export const setDriverOnlineMutationFn = async (isOnline: boolean): Promise<OnlineResponse> =>
  API.patch("/driver/online", { isOnline });

/* Partner applications */

export type PartnerRole = "store_owner" | "restaurant_owner" | "driver";
export type ApplicationStatus = "pending" | "approved" | "rejected";

export type PartnerApplication = {
  _id: string;
  requestedRole: PartnerRole;
  status: ApplicationStatus;
  businessName?: string;
  area?: string;
  phone: string;
  vehicle?: string;
  note?: string;
  reviewNote?: string;
  createdAt: string;
};

export type PartnerApplicationInput = {
  requestedRole: PartnerRole;
  businessName?: string;
  area?: string;
  phone: string;
  vehicle?: string;
  note?: string;
};

type ApplicationResponse = { message: string; data: { application: PartnerApplication } };
type MyApplicationResponse = { message: string; data: { application: PartnerApplication | null } };

export const applyToBePartnerMutationFn = async (
  input: PartnerApplicationInput,
): Promise<ApplicationResponse> => API.post("/partner-applications", input);

export const getMyApplicationQueryFn = async (): Promise<MyApplicationResponse> =>
  API.get("/partner-applications/mine");

/* Push notifications */

export const registerPushTokenMutationFn = async (
  token: string,
): Promise<{ message: string }> => API.post("/auth/push-token", { token });

export const removePushTokenMutationFn = async (
  token: string,
): Promise<{ message: string }> => API.delete("/auth/push-token", { data: { token } });

/* Payment preferences — which KIND of payment to open checkout on */

export type PaymentMethodOption = {
  method: PaymentMethod;
  available: boolean;
  reason?: string;
};

export type PaymentPreferences = {
  preferred: PaymentMethod;
  /** False while the customer is still on the inherited default. */
  isExplicit: boolean;
  methods: PaymentMethodOption[];
  cod: { maxOrderValue: number; available: boolean; reason?: string };
};

type PaymentPreferencesResponse = { message: string; data: PaymentPreferences };

export const getPaymentPreferencesQueryFn = async (): Promise<PaymentPreferencesResponse> =>
  API.get("/payment-methods");

/**
 * Saves which kind of payment to open checkout on. No instrument is stored —
 * not a card, not a UPI handle — only the choice of method.
 */
export const setPaymentPreferenceMutationFn = async (input: {
  method: PaymentMethod;
}): Promise<PaymentPreferencesResponse> => API.patch("/payment-methods", input);

/* Image presets — stand-in tiles for a catalogue item with no photograph */

export type ImagePreset = {
  key: string;
  label: string;
  /** An emoji, so it draws identically here and in the backoffice. */
  glyph: string;
  colors: [string, string];
  catalogue: "grocery" | "food";
};

type ImagePresetsResponse = {
  message: string;
  data: { presets: ImagePreset[]; uploadsEnabled: boolean };
};

export const getImagePresetsQueryFn = async (): Promise<ImagePresetsResponse> =>
  API.get("/image-presets");
