/** Shapes returned by the admin rider service. */

import { DriverStatus } from "../models/user.model";

export type AdminRiderRow = {
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
  earnings: number;
  activeDeliveries: number;
  lastDeliveryAt?: string;
  createdAt: string;
};

export type AdminRiderStats = {
  total: number;
  online: number;
  pending: number;
  earningsToday: number;
};

export type AdminRiderList = {
  riders: AdminRiderRow[];
  total: number;
  page: number;
  pages: number;
  stats: AdminRiderStats;
};
