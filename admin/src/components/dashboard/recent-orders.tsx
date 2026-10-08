import { ArrowRightIcon } from "lucide-react";
import { Link } from "react-router";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { OrderStatusBadge } from "@/components/dashboard/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentOrder } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";

const columns: DataTableColumns<RecentOrder> = [
  {
    accessorKey: "reference",
    cell: ({ row }) => <span className="font-medium">#{row.original.reference}</span>,
    header: "Order",
  },
  { accessorKey: "contactName", header: "Customer" },
  { accessorKey: "restaurantName", header: "Restaurant" },
  {
    accessorKey: "total",
    cell: ({ row }) => formatMoney(row.original.total),
    header: "Total",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    enableSorting: false,
    header: "Status",
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
];

export function RecentOrders({ orders, isLoading }: { orders?: RecentOrder[]; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
        <CardAction>
          <Button asChild className="text-primary hover:text-primary" size="sm" variant="ghost">
            <Link to="/orders">
              View all orders
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <DataTable
          columns={columns}
          data={orders ?? []}
          emptyMessage="No paid orders yet."
          isLoading={isLoading}
        />
      </CardContent>
    </Card>
  );
}
