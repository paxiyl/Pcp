import {
  BanIcon,
  BikeIcon,
  CheckCircle2Icon,
  ClockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrendingUpIcon,
  UserCheckIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { RiderFormDialog } from "@/components/riders/rider-form-dialog";
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
import { useAdminRiders, useUpdateRider } from "@/features/riders/use-admin-riders";
import type { AdminRider, AdminRiderFilters, DriverStatus } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { formatAgo, formatMoney } from "@/lib/format";
import { tintedStyle } from "@/lib/order-status";

const PAGE_SIZE = 10;

/** Verification and availability read as the same kind of chip, from one place. */
const VERIFICATION: Record<DriverStatus, { label: string; color: string }> = {
  approved: { color: "oklch(0.57 0.14 150)", label: "Approved" },
  pending: { color: "oklch(0.66 0.14 80)", label: "Pending" },
  suspended: { color: "oklch(0.58 0.20 25)", label: "Suspended" },
};

const ONLINE_COLOR = "oklch(0.57 0.14 150)";
const BUSY_COLOR = "oklch(0.56 0.12 175)";
const OFFLINE_COLOR = "oklch(0.58 0 0)";

const availabilityOf = (rider: AdminRider) => {
  if (rider.activeDeliveries > 0) return { color: BUSY_COLOR, label: "On delivery" };
  if (rider.isOnline) return { color: ONLINE_COLOR, label: "Online" };

  return { color: OFFLINE_COLOR, label: "Offline" };
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function RidersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [verification, setVerification] = useState("all");
  const [editing, setEditing] = useState<AdminRider | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, verification]);

  const filters: AdminRiderFilters = {
    limit: PAGE_SIZE,
    page,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(verification !== "all" ? { verification: verification as DriverStatus } : {}),
  };

  const { data, isLoading } = useAdminRiders(filters);
  const update = useUpdateRider();

  const openDialog = (rider?: AdminRider) => {
    setEditing(rider);
    setDialogOpen(true);
  };

  const setStatus = (rider: AdminRider, driverStatus: DriverStatus, message: string) =>
    update.mutate(
      { id: rider._id, driverStatus },
      {
        onError: (error) =>
          toast.error("Could not update the rider", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () => toast.success(message),
      },
    );

  const columns: DataTableColumns<AdminRider> = [
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
      header: "Rider",
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
    {
      accessorKey: "driverStatus",
      cell: ({ row }) => {
        const { color, label } = VERIFICATION[row.original.driverStatus];

        return (
          <Badge
            className="border-transparent font-medium"
            style={tintedStyle(color)}
            variant="secondary"
          >
            {label}
          </Badge>
        );
      },
      enableSorting: false,
      header: "Verification",
    },
    {
      accessorKey: "isOnline",
      cell: ({ row }) => {
        const { color, label } = availabilityOf(row.original);

        return (
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span style={{ color }}>{label}</span>
          </span>
        );
      },
      enableSorting: false,
      header: "Availability",
    },
    { accessorKey: "deliveries", header: "Deliveries" },
    {
      accessorKey: "earnings",
      cell: ({ row }) => formatMoney(row.original.earnings),
      header: "Earnings",
    },
    {
      accessorKey: "rating",
      cell: ({ row }) =>
        row.original.deliveries === 0 || row.original.rating === undefined ? (
          <span className="text-muted-foreground">New</span>
        ) : (
          row.original.rating.toFixed(1)
        ),
      header: "Rating",
    },
    {
      accessorKey: "lastDeliveryAt",
      cell: ({ row }) =>
        row.original.lastDeliveryAt ? (
          `${formatAgo(row.original.lastDeliveryAt)} ago`
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
      header: "Last delivery",
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
              <DropdownMenuItem onSelect={() => openDialog(row.original)}>
                <PencilIcon data-icon="inline-start" />
                Edit rider
              </DropdownMenuItem>

              {row.original.driverStatus === "approved" ? null : (
                <DropdownMenuItem
                  onSelect={() =>
                    setStatus(row.original, "approved", `${row.original.name} approved`)
                  }
                >
                  <CheckCircle2Icon data-icon="inline-start" />
                  Approve rider
                </DropdownMenuItem>
              )}

              {row.original.driverStatus === "suspended" ? null : (
                <DropdownMenuItem
                  onSelect={() =>
                    setStatus(row.original, "suspended", `${row.original.name} suspended`)
                  }
                  variant="destructive"
                >
                  <BanIcon data-icon="inline-start" />
                  {row.original.driverStatus === "pending"
                    ? "Reject application"
                    : "Suspend rider"}
                </DropdownMenuItem>
              )}
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
    { icon: BikeIcon, label: "Total riders", value: data?.stats.total },
    { icon: UserCheckIcon, label: "Online now", value: data?.stats.online },
    { icon: ClockIcon, label: "Pending approval", value: data?.stats.pending },
    {
      icon: TrendingUpIcon,
      label: "Payouts today",
      value: data ? formatMoney(data.stats.earningsToday) : undefined,
    },
  ];

  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Riders</h1>
          <p className="text-muted-foreground">
            Approve riders and monitor delivery performance.
          </p>
        </div>

        <Button onClick={() => openDialog(undefined)}>
          <PlusIcon data-icon="inline-start" />
          Add rider
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            All riders
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
                placeholder="Search rider name, email or phone"
                value={search}
              />
            </InputGroup>

            <Select onValueChange={setVerification} value={verification}>
              <SelectTrigger className="lg:w-48">
                <SelectValue placeholder="Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">All verifications</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={columns}
            data={data?.riders ?? []}
            emptyMessage="No riders match these filters."
            isLoading={isLoading}
            pagination={{
              noun: "rider",
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

      <RiderFormDialog onOpenChange={setDialogOpen} open={dialogOpen} rider={editing} />
    </div>
  );
}
