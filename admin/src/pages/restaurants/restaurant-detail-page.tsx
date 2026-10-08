import {
  ArrowLeftIcon,
  ClockIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShoppingBagIcon,
  StarIcon,
  TruckIcon,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { DishFormDialog } from "@/components/restaurants/dish-form-dialog";
import { RestaurantFormDialog } from "@/components/restaurants/restaurant-form-dialog";
import { RestaurantOrdersTab } from "@/components/restaurants/restaurant-orders-tab";
import { RestaurantOverviewTab } from "@/components/restaurants/restaurant-overview-tab";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminRestaurant, useUpdateDish } from "@/features/restaurants/use-dishes";
import type { AdminDish } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { tintedStyle } from "@/lib/order-status";

const OPEN_COLOR = "oklch(0.57 0.14 150)";
const CLOSED_COLOR = "oklch(0.58 0 0)";

/** Underlined tabs in brand teal, as in the design, not the pill default. */
const TAB_CLASS =
  "h-auto flex-none rounded-none px-1 pb-3 text-sm after:bottom-[-1px] after:bg-primary data-active:text-primary";

export function RestaurantDetailPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { data, isLoading, error } = useAdminRestaurant(restaurantId ?? "");
  const updateDish = useUpdateDish();

  const [search, setSearch] = useState("");
  const [section, setSection] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [editingDish, setEditingDish] = useState<AdminDish | undefined>();
  const [dishDialogOpen, setDishDialogOpen] = useState(false);
  const [restaurantDialogOpen, setRestaurantDialogOpen] = useState(false);

  const back = (
    <Button asChild className="w-fit" size="sm" variant="ghost">
      <Link to="/restaurants">
        <ArrowLeftIcon data-icon="inline-start" />
        Back to restaurants
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Restaurant not found</EmptyTitle>
            <EmptyDescription>
              {error instanceof ApiError ? error.message : "That restaurant does not exist."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const { restaurant, dishes, sections, stats, defaultCommissionRate } = data;

  const openDish = (dish?: AdminDish) => {
    setEditingDish(dish);
    setDishDialogOpen(true);
  };

  const toggleAvailable = (dish: AdminDish) =>
    updateDish.mutate(
      { id: dish._id, isAvailable: !dish.isAvailable },
      {
        onError: (mutationError) =>
          toast.error("Could not update the dish", {
            description:
              mutationError instanceof ApiError ? mutationError.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(`${dish.name} is now ${dish.isAvailable ? "unavailable" : "available"}`),
      },
    );

  const visibleDishes = dishes.filter((dish) => {
    const matchesSearch = dish.name.toLowerCase().includes(search.trim().toLowerCase());
    const matchesSection = section === "all" || dish.section === section;
    const matchesAvailability =
      availability === "all" ||
      (availability === "available" ? dish.isAvailable : !dish.isAvailable);

    return matchesSearch && matchesSection && matchesAvailability;
  });

  const columns: DataTableColumns<AdminDish> = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.imageUrl ? (
            <img alt="" className="size-10 rounded-lg object-cover" src={row.original.imageUrl} />
          ) : (
            <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
              <ImageIcon className="size-4" />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.name}</span>
            {row.original.optionGroups.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                {row.original.optionGroups.length} option{" "}
                {row.original.optionGroups.length === 1 ? "group" : "groups"}
              </span>
            ) : null}
          </div>
        </div>
      ),
      header: "Dish",
    },
    {
      accessorKey: "section",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.section}</span>,
      header: "Category",
    },
    {
      accessorKey: "price",
      cell: ({ row }) => formatMoney(row.original.price),
      header: "Price",
    },
    {
      accessorKey: "isAvailable",
      cell: ({ row }) => (
        <Badge
          className="gap-1.5 border-transparent font-medium"
          style={tintedStyle(row.original.isAvailable ? OPEN_COLOR : CLOSED_COLOR)}
          variant="secondary"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: row.original.isAvailable ? OPEN_COLOR : CLOSED_COLOR }}
          />
          {row.original.isAvailable ? "Available" : "Unavailable"}
        </Badge>
      ),
      enableSorting: false,
      header: "Availability",
    },
    {
      accessorKey: "updatedAt",
      cell: ({ row }) => {
        const { date, time } = formatDateTime(row.original.updatedAt);

        return (
          <div className="flex flex-col leading-tight">
            <span>{date}</span>
            <span className="text-muted-foreground text-xs">{time}</span>
          </div>
        );
      },
      header: "Updated",
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
              <DropdownMenuItem onSelect={() => openDish(row.original)}>
                <PencilIcon data-icon="inline-start" />
                Edit dish
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleAvailable(row.original)}>
                {row.original.isAvailable ? "Mark unavailable" : "Mark available"}
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

  const facts = [
    {
      icon: ClockIcon,
      label: `${restaurant.prepTimeMinMinutes}–${restaurant.prepTimeMaxMinutes} min`,
    },
    {
      icon: TruckIcon,
      label:
        restaurant.deliveryFee === 0
          ? "Free delivery"
          : `${formatMoney(restaurant.deliveryFee)} delivery`,
    },
    { icon: ShoppingBagIcon, label: `Min. order ${formatMoney(restaurant.minOrder)}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{restaurant.name}</h1>

            <Badge
              className="gap-1.5 border-transparent font-medium"
              style={tintedStyle(restaurant.isOpen ? OPEN_COLOR : CLOSED_COLOR)}
              variant="secondary"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: restaurant.isOpen ? OPEN_COLOR : CLOSED_COLOR }}
              />
              {restaurant.isOpen ? "Open" : "Paused"}
            </Badge>

            {/* Only worth saying when it is true: inactive hides it from the app. */}
            {restaurant.isActive ? null : <Badge variant="secondary">Inactive</Badge>}
          </div>

          <p className="text-muted-foreground">
            {restaurant.cuisines.join(" · ") || "No cuisine"} · {restaurant.address || "No address"}
          </p>

          <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <StarIcon className="size-4 fill-amber-500 text-amber-500" />
              <span className="text-foreground font-semibold">{restaurant.rating.toFixed(1)}</span>
              ({restaurant.ratingCount})
            </span>

            {facts.map(({ icon: Icon, label }) => (
              <span className="flex items-center gap-1.5" key={label}>
                <Icon className="size-4" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <Button onClick={() => setRestaurantDialogOpen(true)} variant="outline">
          <PencilIcon data-icon="inline-start" />
          Edit restaurant
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList
          className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0"
          variant="line"
        >
          <TabsTrigger className={TAB_CLASS} value="overview">
            Overview
          </TabsTrigger>
          <TabsTrigger className={TAB_CLASS} value="dishes">
            Dishes
          </TabsTrigger>
          <TabsTrigger className={TAB_CLASS} value="orders">
            Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="overview">
          <RestaurantOverviewTab
            defaultCommissionRate={defaultCommissionRate}
            restaurant={restaurant}
            stats={stats}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="dishes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Dishes
                <Badge variant="secondary">{dishes.length}</Badge>
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                Manage dishes available from {restaurant.name}.
              </p>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 lg:flex-row">
                <InputGroup className="lg:max-w-sm">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dishes"
                    value={search}
                  />
                </InputGroup>

                <Select onValueChange={setSection} value={section}>
                  <SelectTrigger className="lg:w-44">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All categories</SelectItem>
                      {sections.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select onValueChange={setAvailability} value={availability}>
                  <SelectTrigger className="lg:w-44">
                    <SelectValue placeholder="All availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All availability</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button className="lg:ml-auto" onClick={() => openDish(undefined)}>
                  <PlusIcon data-icon="inline-start" />
                  Add dish
                </Button>
              </div>

              <DataTable
                columns={columns}
                data={visibleDishes}
                emptyMessage="No dishes match these filters."
                pageSize={10}
                paginated
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="mt-6" value="orders">
          <RestaurantOrdersTab restaurantId={restaurant._id} />
        </TabsContent>
      </Tabs>

      <DishFormDialog
        dish={editingDish}
        onOpenChange={setDishDialogOpen}
        open={dishDialogOpen}
        restaurantId={restaurant._id}
        restaurantName={restaurant.name}
        sections={sections}
      />

      <RestaurantFormDialog
        defaultCommissionRate={defaultCommissionRate}
        onOpenChange={setRestaurantDialogOpen}
        open={restaurantDialogOpen}
        restaurant={restaurant}
      />
    </div>
  );
}
