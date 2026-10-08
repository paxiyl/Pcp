/** Shapes returned by the admin customer service. */

export type AdminCustomerRow = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  orders: number;
  totalSpent: number;
  lastOrderAt?: string;
  createdAt: string;
};

export type AdminCustomerStats = {
  total: number;
  activeThisMonth: number;
  newThisMonth: number;
};

export type AdminCustomerList = {
  customers: AdminCustomerRow[];
  total: number;
  page: number;
  pages: number;
  stats: AdminCustomerStats;
};
