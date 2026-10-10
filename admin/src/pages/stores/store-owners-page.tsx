import { AlertTriangleIcon, PlusIcon, SearchIcon, UserCogIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { StoreOwnerFormDialog } from "@/components/stores/store-owner-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  useDeactivateStoreOwner,
  useStoreOwners,
} from "@/features/catalogue/use-store-owners";
import { useStores } from "@/features/catalogue/use-catalogue";
import type { StoreOwnerRow } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";
import { formatDateTime } from "@/lib/format";

/**
 * The accounts that run each shop.
 *
 * Until this page existed, attaching a shopkeeper to a shop needed a direct
 * database write — which is not an onboarding process, it is a reason not to
 * onboard anyone.
 */
export function StoreOwnersPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StoreOwnerRow | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useStoreOwners(debounced ? { search: debounced } : {});
  const { data: stores } = useStores();
  const deactivate = useDeactivateStoreOwner();

  /** Shops with nobody running them. The reason an admin opens this page. */
  const unclaimed = (stores ?? []).filter(
    (store) => !(data?.owners ?? []).some((owner) => owner.store?._id === store._id),
  );

  const columns: DataTableColumns<StoreOwnerRow> = [
    {
      accessorKey: "name",
      header: "Owner",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: "store",
      header: "Shop",
      cell: ({ row }) =>
        row.original.store ? (
          <span>{row.original.store.name}</span>
        ) : (
          // An owner with no shop can do nothing at all, so it is flagged rather
          // than left as an empty cell.
          <Badge className="gap-1" variant="outline">
            <AlertTriangleIcon className="size-3" />
            Not linked
          </Badge>
        ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.phone ?? "—"}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => {
        const { date } = formatDateTime(row.original.createdAt);

        return <span className="text-muted-foreground">{date}</span>;
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "outline"}>
          {row.original.isActive ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            onClick={(event) => {
              event.stopPropagation();
              setEditing(row.original);
              setDialogOpen(true);
            }}
            size="sm"
            variant="ghost"
          >
            Edit
          </Button>
          {row.original.isActive ? (
            <Button
              onClick={async (event) => {
                event.stopPropagation();

                // eslint-disable-next-line no-alert
                if (!window.confirm(`Deactivate ${row.original.name}? They will be signed out.`)) {
                  return;
                }

                try {
                  await deactivate.mutateAsync(row.original._id);
                  toast.success("Store owner deactivated");
                } catch (error) {
                  toast.error(apiMessage(error, "Could not deactivate that account."));
                }
              }}
              size="sm"
              variant="ghost"
            >
              <span className="text-destructive">Deactivate</span>
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Store owners</h1>
          <p className="text-muted-foreground text-sm">
            Accounts that manage a shop from the Raket app.
          </p>
        </div>

        <Button
          disabled={(stores ?? []).length === 0}
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <PlusIcon className="size-4" />
          Add store owner
        </Button>
      </div>

      {unclaimed.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium">
                {unclaimed.length} shop{unclaimed.length === 1 ? " has" : "s have"} no owner account
              </p>
              <p className="text-muted-foreground">
                {unclaimed.map((store) => store.name).join(", ")} — nobody can accept their orders
                from the app.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <UserCogIcon className="size-4" />
            {data?.total ?? 0} owners
          </CardTitle>

          <InputGroup className="w-full max-w-xs">
            <InputGroupAddon>
              <SearchIcon className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              value={search}
            />
          </InputGroup>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={data?.owners ?? []}
            emptyMessage={
              debounced
                ? `No owner matches "${debounced}".`
                : "No store owners yet. Add one so a shop can accept its own orders."
            }
            isLoading={isLoading}
            paginated
            pageSize={10}
          />
        </CardContent>
      </Card>

      <StoreOwnerFormDialog
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        owner={editing}
        stores={stores ?? []}
      />
    </div>
  );
}
