import { LayoutGridIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProductCategoryFormDialog } from "@/components/stores/product-category-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductCategories } from "@/features/catalogue/use-catalogue";
import { useDeleteProductCategory } from "@/features/catalogue/use-store-owners";
import type { AdminProductCategory } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";

/**
 * The grocery taxonomy. Separate from restaurant cuisines, and two levels deep.
 *
 * Shown as a tree rather than a flat table: the parent/child relationship IS the
 * thing being edited here, and a table with a "parent" column makes you read the
 * structure instead of seeing it.
 */
export function ProductCategoriesPage() {
  const { data: categories, isLoading } = useProductCategories();
  const remove = useDeleteProductCategory();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProductCategory | undefined>();
  const [parentFor, setParentFor] = useState<string | null>(null);

  const parents = (categories ?? []).filter((category) => !category.parentId);
  const childrenOf = (id: string) =>
    (categories ?? []).filter((category) => category.parentId === id);

  const deleteCategory = async (category: AdminProductCategory) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove "${category.name}"?`)) return;

    try {
      await remove.mutateAsync(category._id);
      toast.success("Category removed");
    } catch (error) {
      // The API refuses to delete a category that still holds products or
      // children, and its message names the count — which is the useful part.
      toast.error(apiMessage(error, "Could not remove that category."));
    }
  };

  const row = (category: AdminProductCategory, child: boolean) => (
    <div
      className={`flex items-center gap-3 border-t px-4 py-3 ${child ? "pl-12" : ""}`}
      key={category._id}
    >
      <div
        className="size-8 shrink-0 rounded-lg border"
        style={{ backgroundColor: category.backgroundColor }}
      />

      <div className="flex-1">
        <span className="font-medium">{category.name}</span>
        <span className="text-muted-foreground ml-2 text-xs">{category.slug}</span>
      </div>

      <Badge variant={category.productCount > 0 ? "secondary" : "outline"}>
        {category.productCount} product{category.productCount === 1 ? "" : "s"}
      </Badge>

      {!child ? (
        <Button
          onClick={() => {
            setEditing(undefined);
            setParentFor(category._id);
            setDialogOpen(true);
          }}
          size="sm"
          variant="ghost"
        >
          Add sub
        </Button>
      ) : null}

      <Button
        onClick={() => {
          setEditing(category);
          setParentFor(null);
          setDialogOpen(true);
        }}
        size="sm"
        variant="ghost"
      >
        Edit
      </Button>

      <Button
        aria-label={`Remove ${category.name}`}
        onClick={() => void deleteCategory(category)}
        size="icon"
        variant="ghost"
      >
        <Trash2Icon className="text-destructive size-4" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Product categories</h1>
          <p className="text-muted-foreground text-sm">
            How customers browse groceries, medicine, cosmetics and the rest. Two levels deep.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(undefined);
            setParentFor(null);
            setDialogOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Add category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGridIcon className="size-4" />
            {parents.length} departments
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 px-4">
              {[0, 1, 2, 3].map((key) => (
                <Skeleton className="h-12 w-full" key={key} />
              ))}
            </div>
          ) : parents.length === 0 ? (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">
              No categories yet. Add a department to start organising the catalogue.
            </p>
          ) : (
            <div>
              {parents.map((parent) => (
                <div key={parent._id}>
                  {row(parent, false)}
                  {childrenOf(parent._id).map((child) => row(child, true))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ProductCategoryFormDialog
        category={editing}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        parentId={parentFor}
        parents={parents}
      />
    </div>
  );
}
