import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { ProductFormDialog } from "@/components/stores/product-form-dialog";
import { StoreFormDialog } from "@/components/stores/store-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeleteProduct, useProducts, useStore } from "@/features/catalogue/use-catalogue";
import type { AdminProduct } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";
import { formatMoney } from "@/lib/format";

const PAGE_SIZE = 20;

/**
 * One store and its shelf.
 *
 * The product table requests `includeVariants` so every SKU is listed. The app
 * collapses a variant group to one card because a shopper wants one shirt; an
 * admin counting stock wants all four sizes.
 */
export function StoreDetailPage() {
  const navigate = useNavigate();
  const { storeSlug } = useParams<{ storeSlug: string }>();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editingStore, setEditingStore] = useState(false);
  const [productDialog, setProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [debounced]);

  const { data, isLoading } = useStore(storeSlug ?? "");
  const store = data?.store;

  const products = useProducts({
    includeVariants: true,
    limit: PAGE_SIZE,
    page,
    search: debounced || undefined,
    storeId: store?._id,
  });

  const remove = useDeleteProduct();

  const deleteProduct = async (product: AdminProduct) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove ${product.name} from this shelf? This cannot be undone.`)) return;

    try {
      await remove.mutateAsync(product._id);
      toast.success("Product removed");
    } catch (error) {
      toast.error(apiMessage(error, "Could not remove that product."));
    }
  };

  const columns: DataTableColumns<AdminProduct> = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.brand ? `${row.original.brand} · ` : ""}
            {row.original.variantLabel
              ? `${row.original.variantType}: ${row.original.variantLabel}`
              : row.original.unit}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium tabular-nums">{formatMoney(row.original.price)}</span>
          {row.original.mrp > row.original.price ? (
            <span className="text-muted-foreground text-xs tabular-nums line-through">
              {formatMoney(row.original.mrp)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "stock",
      header: "Stock",
      // The number an admin opens this page to check, so low stock is coloured
      // rather than left to be spotted in a column of similar digits.
      cell: ({ row }) => {
        const { stock } = row.original;

        return (
          <span
            className={
              stock === 0
                ? "text-destructive font-medium tabular-nums"
                : stock <= 5
                  ? "font-medium tabular-nums text-amber-600"
                  : "tabular-nums"
            }
          >
            {stock}
          </span>
        );
      },
    },
    {
      id: "flags",
      header: "Flags",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.requiresPrescription ? (
            <Badge className="gap-1" variant="outline">
              <AlertTriangleIcon className="size-3" />
              Rx
            </Badge>
          ) : null}
          {row.original.isPopular ? <Badge variant="secondary">Popular</Badge> : null}
          {!row.original.isAvailable ? <Badge variant="outline">Delisted</Badge> : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            aria-label={`Edit ${row.original.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setEditingProduct(row.original);
              setProductDialog(true);
            }}
            size="icon"
            variant="ghost"
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            aria-label={`Remove ${row.original.name}`}
            onClick={(event) => {
              event.stopPropagation();
              void deleteProduct(row.original);
            }}
            size="icon"
            variant="ghost"
          >
            <Trash2Icon className="text-destructive size-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading || !store) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button className="w-fit px-0" onClick={() => navigate("/stores")} variant="link">
        <ArrowLeftIcon className="size-4" />
        All stores
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{store.name}</h1>
          <p className="text-muted-foreground text-sm">
            {store.storeType}
            {store.area ? ` · ${store.area}` : ""} · {store.etaMinutes} min ·{" "}
            {store.deliveryFee === 0 ? "free delivery" : `${formatMoney(store.deliveryFee)} delivery`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => setEditingStore(true)} variant="outline">
            <PencilIcon className="size-4" />
            Edit store
          </Button>
          <Button
            onClick={() => {
              setEditingProduct(undefined);
              setProductDialog(true);
            }}
          >
            <PlusIcon className="size-4" />
            Add product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <PackageIcon className="size-4" />
            {products.data?.total ?? 0} products
          </CardTitle>

          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search this shelf"
              value={search}
            />
          </InputGroup>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={products.data?.products ?? []}
            emptyMessage={
              debounced
                ? `Nothing on this shelf matches "${debounced}".`
                : "This shop has no products yet."
            }
            isLoading={products.isLoading}
            pagination={{
              noun: "products",
              onPageChange: setPage,
              page,
              pageSize: PAGE_SIZE,
              pages: products.data?.pages ?? 1,
              total: products.data?.total ?? 0,
            }}
          />
        </CardContent>
      </Card>

      <StoreFormDialog onOpenChange={setEditingStore} open={editingStore} store={store} />
      <ProductFormDialog
        onOpenChange={setProductDialog}
        open={productDialog}
        product={editingProduct}
        storeId={store._id}
      />
    </div>
  );
}
