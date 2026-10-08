/** Shapes returned by the admin order service. */

import { OrderStatus } from "../models/order.model";

export type AdminOrderRow = {
  _id: string;
  reference: string;
  contactName: string;
  restaurantName: string;
  itemCount: number;
  total: number;
  /** What the restaurant earns from this order: subtotal minus commission. */
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
