/** Shapes behind the dashboard's analytics pipelines. */

import { OrderStatus } from "../models/order.model";

export type Totals = {
  orders: number;
  revenue: number;
  commission: number;
  riderPayouts: number;
  averageOrderValue: number;
};

export type RevenuePoint = { date: string; revenue: number; commission: number };

/**
 * Revenue split by where it came from.
 *
 * The totals above already counted every paid order whatever the vendor — the
 * gap was never missing grocery revenue, it was being unable to SEE which half
 * was which. Once shops outgrow restaurants that distinction is the number the
 * business turns on.
 */
export type VendorSplit = {
  vendorKind: "restaurant" | "store";
  orders: number;
  revenue: number;
  commission: number;
};

/** How customers are choosing to pay, which decides how much cash riders carry. */
export type PaymentSplit = {
  paymentMethod: string;
  orders: number;
  revenue: number;
};

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

export type OverviewPayload = {
  today: Totals;
  yesterday: Totals;
  series: RevenuePoint[];
  byStatus: StatusCount[];
  recent: RecentOrder[];
  activity: ActivityEvent[];
  liveOrders: number;
  vendorSplit: VendorSplit[];
  paymentSplit: PaymentSplit[];
};
