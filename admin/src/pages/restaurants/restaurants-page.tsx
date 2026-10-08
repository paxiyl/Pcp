import {
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon,
  SearchIcon,
  UtensilsIcon,
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { RestaurantFormDialog } from "@/components/restaurants/restaurant-form-dialog";
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
import {
  useAdminRestaurants,
  useUpdateRestaurant,
} from "@/features/restaurants/use-admin-restaurants";
import type { AdminRestaurantFilters, AdminRestaurantRow } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatMoney } from "@/lib/format";
import { tintedStyle } from "@/lib/order-status";

const PAGE_SIZE = 10;

const ACTIVE_COLOR = "oklch(0.57 0.14 150)";
const INACTIVE_COLOR = "oklch(0.58 0 0)";

export function RestaurantsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [cuisine, setCuisine] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminRestaurantRow | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, cuisine, status]);

  const filters: AdminRestaurantFilters = {
    limit: PAGE_SIZE,
    page,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(cuisine !== "all" ? { cuisine } : {}),
    ...(status !== "all" ? { status: status as "active" | "inactive" } : {}),
  };

  const { data, isLoading } = useAdminRestaurants(filters);
  const update = useUpdateRestaurant();

  const openEdit = (restaurant?: AdminRestaurantRow) => {
    setEditing(restaurant);
    setDialogOpen(true);
  };

  const toggleActive = (restaurant: AdminRestaurantRow) =>
    update.mutate(
      { id: restaurant._id, isActive: !restaurant.isActive },
      {
        onError: (error) =>
          toast.error("Could not update the restaurant", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(
            `${restaurant.name} is now ${restaurant.isActive ? "inactive" : "active"}`,
          ),
      },
    );

  const columns: DataTableColumns<AdminRestaurantRow> = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.imageUrl ? (
            <img
              alt=""
              className="size-10 rounded-lg object-cover"
              src={row.original.imageUrl}
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
              <StoreIcon className="size-4" />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground text-xs">
              {row.original.address || "No address"}
            </span>
          </div>
        </div>
      ),
      header: "Restaurant",
    },
    {
      accessorKey: "cuisines",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.cuisines.join(" · ") || "—"}
        </span>
      ),
      enableSorting: false,
      header: "Cuisine",
    },
    {
      accessorKey: "rating",
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          <StarIcon className="size-3.5 fill-amber-500 text-amber-500" />
          {row.original.rating.toFixed(1)}
          <span className="text-muted-foreground text-xs">({row.original.ratingCount})</span>
        </span>
      ),
      header: "Rating",
    },
    { accessorKey: "ordersToday", header: "Orders today" },
    {
      accessorKey: "deliveryFee",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.prepTimeMinMinutes}–{row.original.prepTimeMaxMinutes} min ·{" "}
          {row.original.deliveryFee === 0 ? "Free" : formatMoney(row.original.deliveryFee)}
        </span>
      ),
      header: "Delivery",
    },
    {
      accessorKey: "commissionRate",
      cell: ({ row }) => {
        const rate = row.original.commissionRate ?? data?.defaultCommissionRate ?? 0;

        return (
          <span className="flex items-center gap-1">
            {Math.round(rate * 100)}%
            {row.original.commissionRate === undefined ? (
              <span className="text-muted-foreground text-xs">default</span>
            ) : null}
          </span>
        );
      },
      header: "Commission",
    },
    {
      accessorKey: "isActive",
      cell: ({ row }) => (
        <Badge
          className="gap-1.5 border-transparent font-medium"
          style={tintedStyle(row.original.isActive ? ACTIVE_COLOR : INACTIVE_COLOR)}
          variant="secondary"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: row.original.isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}
          />
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
      enableSorting: false,
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${row.original.name}`}
              onClick={(event) => event.stopPropagation()}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            onClick={(event) => event.stopPropagation()}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem
                onSelect={() => void navigate(`/restaurants/${row.original._id}`)}
              >
                <UtensilsIcon data-icon="inline-start" />
                Manage menu
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openEdit(row.original)}>
                <PencilIcon data-icon="inline-start" />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => toggleActive(row.original)}
                variant={row.original.isActive ? "destructive" : undefined}
              >
                <PowerIcon data-icon="inline-start" />
                {row.original.isActive ? "Deactivate" : "Activate"}
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
    { label: "Total restaurants", value: data?.stats.total },
    { label: "Active", value: data?.stats.active },
    { label: "Inactive", value: data?.stats.inactive },
  ];

  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Restaurants</h1>
          <p className="text-muted-foreground">Manage restaurant profiles and availability.</p>
        </div>

        <Button onClick={() => openEdit(undefined)}>
          <PlusIcon data-icon="inline-start" />
          Add restaurant
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                <StoreIcon className="size-5" />
              </div>
              <div className="flex flex-col">
                <p className="text-muted-foreground text-sm">{stat.label}</p>
                {isLoading || stat.value === undefined ? (
                  <Skeleton className="mt-1 h-7 w-10" />
                ) : (
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            All restaurants
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
                placeholder="Search restaurants"
                value={search}
              />
            </InputGroup>

            <Select onValueChange={setCuisine} value={cuisine}>
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="All cuisines" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All cuisines</SelectItem>
                  {data?.cuisines.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger className="lg:w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={data?.restaurants ?? []}
            emptyMessage="No restaurants match these filters."
            isLoading={isLoading}
            onRowClick={(restaurant) => void navigate(`/restaurants/${restaurant._id}`)}
            pagination={{
              noun: "restaurant",
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

      <RestaurantFormDialog
        defaultCommissionRate={data?.defaultCommissionRate ?? 0.25}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        restaurant={editing}
      />
    </div>
  );
}
