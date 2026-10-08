/** Shapes returned by the admin category service. */

export type AdminCategoryRow = {
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
  categories: AdminCategoryRow[];
  stats: { total: number; active: number };
};
