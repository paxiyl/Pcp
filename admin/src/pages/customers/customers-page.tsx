import {
  BanIcon,
  MoreHorizontalIcon,
  ReceiptTextIcon,
  RotateCcwIcon,
  SearchIcon,
  SparklesIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminCustomers, useUpdateCustomer } from "@/features/customers/use-admin-customers";
import type { AdminCustomer, AdminCustomerFilters } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { tintedStyle } from "@/lib/order-status";

const PAGE_SIZE = 10;

const ACTIVE_COLOR = "oklch(0.57 0.14 150)";
const SUSPENDED_COLOR = "oklch(0.58 0.20 25)";

const SORTS: { label: string; value: AdminCustomerFilters["sort"] }[] = [
  { label: "Joined date", value: "joined" },
  { label: "Most orders", value: "orders" },
  { label: "Highest spend", value: "spend" },
];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export function CustomersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<AdminCustomerFilters["sort"]>("joined");

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sort, status]);

  const filters: AdminCustomerFilters = {
    limit: PAGE_SIZE,
    page,
    sort,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status !== "all" ? { status: status as "active" | "suspended" } : {}),
  };

  const { data, isLoading } = useAdminCustomers(filters);
  const update = useUpdateCustomer();

  const toggleActive = (customer: AdminCustomer) =>
    update.mutate(
      { id: customer._id, isActive: !customer.isActive },
      {
        onError: (error) =>
          toast.error("Could not update the account", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(
            customer.isActive
              ? `${customer.name}'s account is suspended`
              : `${customer.name}'s account is active again`,
          ),
      },
    );

  const columns: DataTableColumns<AdminCustomer> = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {initialsOf(row.original.name)}
          </div>
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
      header: "Customer",
    },
    {
      accessorKey: "email",
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span>{row.original.email}</span>
          <span className="text-muted-foreground text-xs">{row.original.phone ?? "No phone"}</span>
        </div>
      ),
      header: "Contact",
    },
    { accessorKey: "orders", header: "Orders" },
    {
      accessorKey: "totalSpent",
      cell: ({ row }) => formatMoney(row.original.totalSpent),
      header: "Total spent",
    },
    {
      accessorKey: "lastOrderAt",
      cell: ({ row }) => {
        if (!row.original.lastOrderAt) {
          return <span className="text-muted-foreground">Never</span>;
        }

        const { date, time } = formatDateTime(row.original.lastOrderAt);

        return (
          <div className="flex flex-col leading-tight">
            <span>{date}</span>
            <span className="text-muted-foreground text-xs">{time}</span>
          </div>
        );
      },
      header: "Last order",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => shortDate(row.original.createdAt),
      header: "Joined",
    },
    {
      accessorKey: "isActive",
      cell: ({ row }) => (
        <Badge
          className="gap-1.5 border-transparent font-medium"
          style={tintedStyle(row.original.isActive ? ACTIVE_COLOR : SUSPENDED_COLOR)}
          variant="secondary"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: row.original.isActive ? ACTIVE_COLOR : SUSPENDED_COLOR }}
          />
          {row.original.isActive ? "Active" : "Suspended"}
        </Badge>
      ),
      enableSorting: false,
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for ${row.original.name}`} size="icon" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() =>
                  void navigate(
                    `/orders?customerId=${row.original._id}&customer=${encodeURIComponent(
                      row.original.name,
                    )}`,
                  )
                }
              >
                <ReceiptTextIcon data-icon="inline-start" />
                Order history
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => toggleActive(row.original)}
                variant={row.original.isActive ? "destructive" : undefined}
              >
                {row.original.isActive ? (
                  <BanIcon data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {row.original.isActive ? "Suspend account" : "Reinstate account"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
      header: "",
      id: "actions",
    },
  ];

  const stats = [
    { icon: UsersIcon, label: "Total customers", value: data?.stats.total },
    { icon: UserCheckIcon, label: "Ordered this month", value: data?.stats.activeThisMonth },
    { icon: SparklesIcon, label: "New this month", value: data?.stats.newThisMonth },
  ];

  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">View customer accounts and ordering activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Icon className="size-5" />
              </div>
              <div className="flex flex-col">
                <p className="text-muted-foreground text-sm">{label}</p>
                {isLoading || value === undefined ? (
                  <Skeleton className="mt-1 h-7 w-12" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight">{value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            All customers
            <Badge variant="secondary">{total}</Badge>
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
                placeholder="Search name, email or phone"
                value={search}
              />
            </InputGroup>

            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger className="lg:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              onValueChange={(value) => setSort(value as AdminCustomerFilters["sort"])}
              value={sort}
            >
              <SelectTrigger className="lg:ml-auto lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SORTS.map((option) => (
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
            data={data?.customers ?? []}
            emptyMessage="No customers match these filters."
            isLoading={isLoading}
            pagination={{
              noun: "customer",
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
