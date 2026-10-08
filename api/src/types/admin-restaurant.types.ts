/** Shapes returned by the admin restaurant service. */

export type AdminRestaurantRow = {
  _id: string;
  name: string;
  slug: string;
  imageUrl: string;
  address: string;
  cuisines: string[];
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
  location?: { type: "Point"; coordinates: [number, number] };
  isActive: boolean;
  ordersToday: number;
};

export type AdminRestaurantStats = { total: number; active: number; inactive: number };

export type AdminRestaurantList = {
  restaurants: AdminRestaurantRow[];
  total: number;
  page: number;
  pages: number;
  stats: AdminRestaurantStats;
  cuisines: string[];
  /** Applied when a restaurant has no negotiated rate of its own. */
  defaultCommissionRate: number;
};

export type AdminRestaurantDetailStats = {
  ordersToday: number;
  revenueToday: number;
  activeDishes: number;
};
