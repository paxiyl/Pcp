import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderActions } from "@/components/orders/order-actions";
import { PaymentBadge } from "@/components/orders/payment-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminOrders } from "@/features/orders/use-admin-orders";
import type { AdminOrderFilters, AdminOrderRow, OrderStatus } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";

const PAGE_SIZE = 10;

const STATUS_OPTIONS: OrderStatus[] = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const RANGES: { label: string; value: AdminOrderFilters["range"] }[] = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
];

/** No Restaurant column here: every row on this tab is the same restaurant. */
const columns: DataTableColumns<AdminOrderRow> = [
  {
    accessorKey: "reference",
    cell: ({ row }) => <span className="font-medium">#{row.original.reference}</span>,
    header: "Order",
  },
  { accessorKey: "contactName", header: "Customer" },
  {
    accessorKey: "itemCount",
    cell: ({ row }) =>
      `${row.original.itemCount} ${row.original.itemCount === 1 ? "item" : "items"}`,
    header: "Items",
  },
  {
    accessorKey: "total",
    cell: ({ row }) => formatMoney(row.original.total),
    header: "Customer paid",
  },
  {
    // On the restaurant's own page its share is the number that matters, so it
    // sits beside the order value rather than replacing it.
    accessorKey: "restaurantPayout",
    cell: ({ row }) =>
      // Orders placed before payouts were snapshotted have nothing to show.
      row.original.restaurantPayout > 0 ? (
        <span className="font-medium">{formatMoney(row.original.restaurantPayout)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    header: "Restaurant earns",
  },
  {
    accessorKey: "paidAt",
    cell: ({ row }) => <PaymentBadge paidAt={row.original.paidAt} />,
    enableSorting: false,
    header: "Payment",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    enableSorting: false,
    header: "Status",
  },
  {
    accessorKey: "driverName",
    cell: ({ row }) =>
      row.original.driverName ?? <span className="text-muted-foreground">Unassigned</span>,
    header: "Rider",
  },
  {
    accessorKey: "createdAt",
    cell: ({ row }) => {
      const { date, time } = formatDateTime(row.original.createdAt);

      return (
        <div className="flex flex-col leading-tight">
          <span>{date}</span>
          <span className="text-muted-foreground text-xs">{time}</span>
        </div>
      );
    },
    header: "Date",
  },
  {
    cell: ({ row }) => <OrderActions order={row.original} />,
    enableSorting: false,
    header: "",
    id: "actions",
  },
];

export function RestaurantOrdersTab({ restaurantId }: { restaurantId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<AdminOrderFilters["range"]>("all");

  useEffect(() => {
    setPage(1);
  }, [status, range]);

  const { data, isLoading } = useAdminOrders({
    limit: PAGE_SIZE,
    page,
    range,
    restaurantId,
    ...(status !== "all" ? { status: status as OrderStatus } : {}),
  });

  const total = data?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Orders
          <Badge variant="secondary">{total}</Badge>
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Every order placed with this restaurant.
        </p>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <Select onValueChange={setStatus} value={status}>
            <SelectTrigger className="lg:w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {ORDER_STATUS[option].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            onValueChange={(value) => setRange(value as AdminOrderFilters["range"])}
            value={range}
          >
            <SelectTrigger className="lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RANGES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={data?.orders ?? []}
          emptyMessage="No orders for this restaurant yet."
          isLoading={isLoading}
          onRowClick={(order) => void navigate(`/orders/${order._id}`)}
          pagination={{
            noun: "order",
            onPageChange: setPage,
            page,
            pageSize: PAGE_SIZE,
            pages: data?.pages ?? 1,
            total,
          }}
          skeletonRows={5}
        />
      </CardContent>
    </Card>
  );
}
