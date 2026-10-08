import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  CircleDotIcon,
  GripVerticalIcon,
  ImagesIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BannerFormDialog } from "@/components/banners/banner-form-dialog";
import { BannerTable } from "@/components/banners/banner-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useAdminBanners,
  useDeleteBanner,
  useReorderBanners,
  useUpdateBanner,
} from "@/features/banners/use-banners";
import type { AdminBanner, AdminBannerList } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { queryKeys } from "@/lib/query-client";

type CachedList = { message: string; data: AdminBannerList };

export function BannersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminBanners();
  const update = useUpdateBanner();
  const remove = useDeleteBanner();
  const reorder = useReorderBanners();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminBanner | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState<AdminBanner | undefined>();

  const banners = data?.banners ?? [];

  const openDialog = (banner?: AdminBanner) => {
    setEditing(banner);
    setDialogOpen(true);
  };

  const toggleActive = (banner: AdminBanner) =>
    update.mutate(
      { id: banner._id, isActive: !banner.isActive },
      {
        onError: (error) =>
          toast.error("Could not update the banner", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(banner.isActive ? `${banner.title} moved to drafts` : `${banner.title} is live`),
      },
    );

  const confirmDelete = () => {
    if (!confirming) return;

    remove.mutate(confirming._id, {
      onError: (error) =>
        toast.error("Could not delete the banner", {
          description: error instanceof ApiError ? error.message : "Please try again.",
        }),
      onSuccess: () => toast.success(`${confirming.title} deleted`),
    });

    setConfirming(undefined);
  };

  /**
   * The drop lands immediately and the write follows; a failure refetches, which
   * snaps the rows back to whatever the server still holds.
   */
  const saveOrder = (next: AdminBanner[]) => {
    const ordered = next.map((banner, index) => ({ ...banner, sortOrder: index + 1 }));

    queryClient.setQueryData(queryKeys.adminBanners, (cached: CachedList | undefined) =>
      cached ? { ...cached, data: { ...cached.data, banners: ordered } } : cached,
    );

    reorder.mutate(
      ordered.map((banner) => ({ id: banner._id, sortOrder: banner.sortOrder })),
      {
        onError: (error) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.adminBanners });
          toast.error("Could not save the order", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          });
        },
        onSuccess: () => toast.success("Display order saved"),
      },
    );
  };

  const filtered = search.trim() !== "" || status !== "all";

  const visible = banners.filter((banner) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      banner.title.toLowerCase().includes(term) ||
      banner.subtitle.toLowerCase().includes(term);

    return matchesSearch && (status === "all" || banner.state === status);
  });

  const stats = [
    { icon: ImagesIcon, label: "Total banners", value: data?.stats.total },
    { icon: CircleDotIcon, label: "Active", value: data?.stats.active },
    // "Scheduled" reads as "has dates"; this counts the ones that have not
    // started yet, so a banner running inside its window is not double-counted.
    { icon: CalendarClockIcon, label: "Starting later", value: data?.stats.scheduled },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Banners</h1>
          <p className="text-muted-foreground">
            Manage promotional banners shown in the customer app.
          </p>
        </div>

        <Button onClick={() => openDialog(undefined)}>
          <PlusIcon data-icon="inline-start" />
          Add banner
        </Button>
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
                  <Skeleton className="mt-1 h-7 w-10" />
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
            All banners
            <Badge variant="secondary">{banners.length}</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <InputGroup className="lg:max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search banners"
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
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <p className="text-muted-foreground flex items-center gap-2 text-sm lg:ml-auto">
              {reorder.isPending ? (
                <>
                  <Spinner className="size-4" />
                  Saving order…
                </>
              ) : (
                <>
                  <GripVerticalIcon className="size-4" />
                  {filtered ? "Clear the filters to reorder" : "Drag rows to change display order"}
                </>
              )}
            </p>
          </div>

          <BannerTable
            banners={visible}
            // Dragging a filtered list would reorder rows that are not on screen.
            draggable={!filtered}
            emptyMessage="No banners match these filters."
            isLoading={isLoading}
            onDelete={setConfirming}
            onEdit={openDialog}
            onReorder={saveOrder}
            onToggleActive={toggleActive}
          />

          <p className="text-muted-foreground text-sm">
            The top banner shows first in the carousel. Only live banners inside their dates reach
            the app.
          </p>
        </CardContent>
      </Card>

      <BannerFormDialog banner={editing} onOpenChange={setDialogOpen} open={dialogOpen} />

      <AlertDialog
        onOpenChange={(open) => (open ? null : setConfirming(undefined))}
        open={Boolean(confirming)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the banner for good. To hide it temporarily, move it to drafts instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete banner</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
