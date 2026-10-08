import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderStatCards } from "@/components/orders/order-stat-cards";
import { PaymentBadge } from "@/components/orders/payment-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminOrders, useRestaurantOptions } from "@/features/orders/use-admin-orders";
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

const columns: DataTableColumns<AdminOrderRow> = [
  {
    accessorKey: "reference",
    cell: ({ row }) => <span className="font-medium">#{row.original.reference}</span>,
    header: "Order",
  },
  { accessorKey: "contactName", header: "Customer" },
  {
    accessorKey: "restaurantName",
    // "Vendor", not "Restaurant": this column now carries shops too, and a
    // restaurant-only heading above a kirana's name is just wrong.
    header: "Vendor",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span>{row.original.restaurantName}</span>
        <span className="text-muted-foreground text-xs">
          {row.original.vendorKind === "store" ? "Shop" : "Restaurant"}
          {row.original.paymentMethod === "cod" ? " · Cash" : ""}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "itemCount",
    cell: ({ row }) => `${row.original.itemCount} ${row.original.itemCount === 1 ? "item" : "items"}`,
    header: "Items",
  },
  {
    accessorKey: "total",
    cell: ({ row }) => formatMoney(row.original.total),
    header: "Total",
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
    header: "Driver",
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

export function OrdersPage() {
  const navigate = useNavigate();
  // Set by the Customers page: one customer's order history, in this list.
  const [params, setParams] = useSearchParams();
  const customerId = params.get("customerId") ?? undefined;
  const customerName = params.get("customer");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [restaurantId, setRestaurantId] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState<AdminOrderFilters["range"]>("all");

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change invalidates the page the user was on.
  useEffect(() => {
    setPage(1);
  }, [customerId, debouncedSearch, restaurantId, status, range]);

  const filters: AdminOrderFilters = {
    limit: PAGE_SIZE,
    page,
    range,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(customerId ? { customerId } : {}),
    ...(restaurantId !== "all" ? { restaurantId } : {}),
    ...(status !== "all" ? { status: status as OrderStatus } : {}),
  };

  const { data, isLoading } = useAdminOrders(filters);
  const { data: restaurants } = useRestaurantOptions();

  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">Track and manage orders from payment to delivery.</p>
      </div>

      <OrderStatCards isLoading={isLoading} stats={data?.stats} />

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            All orders
            <Badge variant="secondary">{total}</Badge>

            {customerId ? (
              <Badge className="gap-1 font-medium" variant="outline">
                {customerName ?? "One customer"}
                <button
                  aria-label="Clear the customer filter"
                  className="hover:text-foreground cursor-pointer"
                  onClick={() => setParams({})}
                  type="button"
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <InputGroup className="lg:max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order number or customer"
                value={search}
              />
            </InputGroup>

            <Select onValueChange={setRestaurantId} value={restaurantId}>
              <SelectTrigger className="lg:w-56">
                <SelectValue placeholder="All restaurants" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All restaurants</SelectItem>
                  {restaurants?.map((restaurant) => (
                    <SelectItem key={restaurant._id} value={restaurant._id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

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
              <SelectTrigger className="lg:ml-auto lg:w-40">
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
            emptyMessage="No orders match these filters."
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
            skeletonRows={PAGE_SIZE}
          />
        </CardContent>
      </Card>
    </div>
  );
}
