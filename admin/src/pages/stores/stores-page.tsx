import { PlusIcon, SearchIcon, StoreIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { StoreFormDialog } from "@/components/stores/store-form-dialog";
import { DataTable, type DataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useStores } from "@/features/catalogue/use-catalogue";
import type { AdminStore } from "@/lib/api";
import { formatMoney } from "@/lib/format";

/**
 * Every shop Raket delivers from.
 *
 * Operational density, not storefront polish: a row is a decision about whether
 * a shop is trading and on what terms, so ETA, fees and the minimum sit on the
 * row rather than behind a tap.
 */
export function StoresPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStore | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data: stores, isLoading } = useStores(debounced ? { search: debounced } : {});

  const columns: DataTableColumns<AdminStore> = [
    {
      accessorKey: "name",
      header: "Store",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.storeType}
            {row.original.area ? ` · ${row.original.area}` : ""}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "etaMinutes",
      header: "ETA",
      cell: ({ row }) => <span className="tabular-nums">{row.original.etaMinutes} min</span>,
    },
    {
      accessorKey: "deliveryFee",
      header: "Delivery",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="tabular-nums">
            {row.original.deliveryFee === 0 ? "Free" : formatMoney(row.original.deliveryFee)}
          </span>
          {row.original.freeDeliveryThreshold ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              free over {formatMoney(row.original.freeDeliveryThreshold)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "minOrder",
      header: "Minimum",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.minOrder === 0 ? "—" : formatMoney(row.original.minOrder)}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: "Rating",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.rating} <span className="text-muted-foreground">({row.original.ratingCount})</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      // Two independent facts, and conflating them hides the common case of a
      // live shop that is simply shut for the night.
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={row.original.isActive ? "default" : "outline"}>
            {row.original.isActive ? "Listed" : "Hidden"}
          </Badge>
          <Badge variant={row.original.isOpen ? "secondary" : "outline"}>
            {row.original.isOpen ? "Open" : `Closed · ${row.original.closesAt}`}
          </Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stores</h1>
          <p className="text-muted-foreground text-sm">
            Shops delivering for Raket across Hindaun.
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Add store
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="size-4" />
            {stores?.length ?? 0} stores
          </CardTitle>

          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, type or area"
              value={search}
            />
          </InputGroup>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={stores ?? []}
            emptyMessage={
              debounced
                ? `No store matches "${debounced}".`
                : "No stores yet. Add one to start listing products."
            }
            isLoading={isLoading}
            onRowClick={(store) => navigate(`/stores/${store.slug}`)}
            paginated
            pageSize={10}
          />
        </CardContent>
      </Card>

      <StoreFormDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        store={editing}
      />
    </div>
  );
}
