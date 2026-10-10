import { CheckIcon, RotateCcwIcon, SearchXIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemand, useResolveDemand } from "@/features/demand/use-demand";
import type { DemandMode, DemandSignal } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";
import { formatAgo, formatDateTime } from "@/lib/format";

const MODE_LABEL: Record<DemandMode, string> = {
  food: "Food",
  grocery: "Groceries",
};

/**
 * What Hindaun asked for and we could not sell them.
 *
 * Every search that returns nothing is recorded, which makes this the one
 * screen in the backoffice that says what to stock next rather than what
 * already happened. The ones customers actively asked for — a tap on "we want
 * this" in the app — sort above bare searches, because a deliberate request is
 * worth more than a search that may have been a typo.
 */
export function DemandPage() {
  const [tab, setTab] = useState<DemandMode | "all">("all");
  const [includeResolved, setIncludeResolved] = useState(false);

  const { data, isLoading } = useDemand(tab, includeResolved);
  const resolve = useResolveDemand();

  const setResolved = (signal: DemandSignal, resolved: boolean) =>
    resolve.mutate(
      { id: signal._id, resolved },
      {
        onError: (error) => toast.error(apiMessage(error, "Could not update that request.")),
        onSuccess: (response) => toast.success(response.message),
      },
    );

  const columns: DataTableColumns<DemandSignal> = [
    {
      accessorKey: "term",
      header: "Searched for",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.term}</span>
          {row.original.resolvedAt ? <Badge variant="secondary">Stocked</Badge> : null}
        </div>
      ),
    },
    {
      accessorKey: "mode",
      header: "Looking in",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{MODE_LABEL[row.original.mode]}</span>
      ),
    },
    {
      accessorKey: "askedCount",
      header: "Asked for it",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {row.original.askedCount > 0 ? row.original.askedCount : "—"}
        </span>
      ),
    },
    {
      accessorKey: "requests",
      header: "Empty searches",
      cell: ({ row }) => <span className="tabular-nums">{row.original.requests}</span>,
    },
    {
      accessorKey: "lastSeenAt",
      header: "Last asked",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">
          {formatAgo(row.original.lastSeenAt)} ago
        </span>
      ),
    },
    {
      accessorKey: "firstSeenAt",
      header: "First asked",
      cell: ({ row }) => {
        const { date } = formatDateTime(row.original.firstSeenAt);

        return <span className="text-muted-foreground text-sm">{date}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.resolvedAt ? (
            <Button
              onClick={() => setResolved(row.original, false)}
              size="sm"
              variant="outline"
            >
              <RotateCcwIcon className="size-4" />
              Still missing
            </Button>
          ) : (
            <Button onClick={() => setResolved(row.original, true)} size="sm">
              <CheckIcon className="size-4" />
              Someone stocks it
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">What people want</h1>
        <p className="text-muted-foreground text-sm">
          Searches that found nothing. Each row is a customer telling you what to stock — the
          "asked for it" column counts the ones who tapped through to say so.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <SearchXIcon className="text-muted-foreground size-4" />
            Unmet demand
          </CardTitle>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={includeResolved}
                id="include-resolved"
                onCheckedChange={setIncludeResolved}
              />
              <Label className="text-sm font-normal" htmlFor="include-resolved">
                Show stocked
              </Label>
            </div>

            <Tabs onValueChange={(value) => setTab(value as DemandMode | "all")} value={tab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="grocery">Groceries</TabsTrigger>
                <TabsTrigger value="food">Food</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent>
          <DataTable
            columns={columns}
            data={data ?? []}
            emptyMessage={
              includeResolved
                ? "Nobody has searched for anything you do not sell."
                : "Nothing outstanding — every search people made found something."
            }
            isLoading={isLoading}
            paginated
          />
        </CardContent>
      </Card>
    </div>
  );
}
