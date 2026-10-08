import { useQueryClient } from "@tanstack/react-query";
import { GripVerticalIcon, LayersIcon, LayoutGridIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CategoryFormDialog } from "@/components/categories/category-form-dialog";
import { CategoryTable } from "@/components/categories/category-table";
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
  useAdminCategories,
  useReorderCategories,
  useUpdateCategory,
} from "@/features/categories/use-admin-categories";
import type { AdminCategory, AdminCategoryList } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";
import { queryKeys } from "@/lib/query-client";

type CachedList = { message: string; data: AdminCategoryList };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminCategories();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<AdminCategory | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const categories = data?.categories ?? [];

  const openDialog = (category?: AdminCategory) => {
    setEditing(category);
    setDialogOpen(true);
  };

  const toggleActive = (category: AdminCategory) =>
    update.mutate(
      { id: category._id, isActive: !category.isActive },
      {
        onError: (error) =>
          toast.error("Could not update the category", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: () =>
          toast.success(`${category.name} is now ${category.isActive ? "inactive" : "active"}`),
      },
    );

  /**
   * The drop lands immediately and the write follows; a failure refetches, which
   * snaps the rows back to whatever the server still holds.
   */
  const saveOrder = (next: AdminCategory[]) => {
    const ordered = next.map((category, index) => ({ ...category, sortOrder: index + 1 }));

    queryClient.setQueryData(queryKeys.adminCategories, (cached: CachedList | undefined) =>
      cached ? { ...cached, data: { ...cached.data, categories: ordered } } : cached,
    );

    reorder.mutate(
      ordered.map((category) => ({ id: category._id, sortOrder: category.sortOrder })),
      {
        onError: (error) => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.adminCategories });
          toast.error("Could not save the order", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          });
        },
        onSuccess: () => toast.success("Display order saved"),
      },
    );
  };

  const filtered = search.trim() !== "" || status !== "all";

  const visible = categories.filter((category) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      category.name.toLowerCase().includes(term) ||
      category.slug.toLowerCase().includes(term);
    const matchesStatus =
      status === "all" || (status === "active" ? category.isActive : !category.isActive);

    return matchesSearch && matchesStatus;
  });

  const stats = [
    { icon: LayoutGridIcon, label: "Total categories", value: data?.stats.total },
    { icon: LayersIcon, label: "Active categories", value: data?.stats.active },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Organise how customers discover products across OnlineMall.
          </p>
        </div>

        <Button onClick={() => openDialog(undefined)}>
          <PlusIcon data-icon="inline-start" />
          Add category
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
            All categories
            <Badge variant="secondary">{categories.length}</Badge>
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
                placeholder="Search categories"
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
                  <SelectItem value="inactive">Inactive</SelectItem>
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

          <CategoryTable
            categories={visible}
            // Dragging a filtered list would reorder rows that are not on screen.
            draggable={!filtered}
            emptyMessage="No categories match these filters."
            isLoading={isLoading}
            onEdit={openDialog}
            onReorder={saveOrder}
            onToggleActive={toggleActive}
          />

          <p className="text-muted-foreground text-sm">
            The top category shows first in the app. Changes reach it the next time a customer
            opens the home screen.
          </p>
        </CardContent>
      </Card>

      <CategoryFormDialog category={editing} onOpenChange={setDialogOpen} open={dialogOpen} />
    </div>
  );
}
