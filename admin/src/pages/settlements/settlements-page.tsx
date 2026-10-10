import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  BikeIcon,
  StoreIcon,
  UtensilsIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useOutstanding,
  useSettleRider,
  useSettleVendor,
  useSettlementHistory,
} from "@/features/settlements/use-settlements";
import type { RiderBalance, Settlement, VendorBalance } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";
import { formatAgo, formatDateTime, formatMoney } from "@/lib/format";

/** What the admin is about to confirm, held while the dialog is open. */
type Pending =
  | { type: "rider"; balance: RiderBalance }
  | { type: "vendor"; balance: VendorBalance };

const PARTY_ICON = {
  restaurant: UtensilsIcon,
  rider: BikeIcon,
  store: StoreIcon,
};

const Figure = ({
  hint,
  label,
  tone = "neutral",
  value,
}: {
  hint: string;
  label: string;
  tone?: "neutral" | "in" | "out";
  value: number;
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="flex items-center gap-1.5">
        {tone === "in" ? (
          <ArrowDownLeftIcon className="size-3.5" />
        ) : tone === "out" ? (
          <ArrowUpRightIcon className="size-3.5" />
        ) : (
          <BanknoteIcon className="size-3.5" />
        )}
        {label}
      </CardDescription>
      <CardTitle className="text-2xl tabular-nums">{formatMoney(value)}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </CardContent>
  </Card>
);

/**
 * Settling up.
 *
 * This is where cash on delivery becomes real money in the business. A rider
 * who collects ₹500 at a door is holding three parties' money at once — the
 * shop's goods, our commission and fees, and their own earnings — and until
 * somebody writes down what was handed over, nobody knows who is square.
 *
 * Two ledgers, because they run in opposite directions. Riders mostly owe US:
 * the cash they took, less what they earned. Shops are mostly owed BY us: the
 * goods they sold, less our commission. A rider doing only prepaid work flips
 * to the other side, which is why their column is signed rather than absolute.
 *
 * Every Settle sends back the figure that was on screen. If a delivery lands
 * between the page loading and the button being pressed, the server refuses:
 * paying out an amount nobody actually agreed to is the one failure here that
 * costs somebody money they cannot get back.
 */
export function SettlementsPage() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [note, setNote] = useState("");
  const [historyParty, setHistoryParty] = useState<Settlement["party"] | "all">("all");

  const { data, isLoading } = useOutstanding();
  const history = useSettlementHistory(historyParty === "all" ? undefined : historyParty);
  const settleRider = useSettleRider();
  const settleVendor = useSettleVendor();

  const busy = settleRider.isPending || settleVendor.isPending;

  const close = () => {
    setPending(null);
    setNote("");
  };

  const confirm = () => {
    if (!pending || busy) return;

    const handlers = {
      onError: (error: unknown) => toast.error(apiMessage(error, "Could not record that.")),
      onSuccess: (response: { message: string }) => {
        toast.success(response.message);
        close();
      },
    };

    if (pending.type === "rider") {
      settleRider.mutate(
        {
          expectedNet: pending.balance.net,
          note: note.trim() || undefined,
          riderId: pending.balance.riderId,
        },
        handlers,
      );

      return;
    }

    settleVendor.mutate(
      {
        expectedNet: pending.balance.net,
        kind: pending.balance.kind,
        note: note.trim() || undefined,
        vendorId: pending.balance.vendorId,
      },
      handlers,
    );
  };

  const riderColumns: DataTableColumns<RiderBalance> = [
    {
      accessorKey: "name",
      header: "Rider",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.orderCount} deliver{row.original.orderCount === 1 ? "y" : "ies"}
            {row.original.oldestAt ? ` · oldest ${formatAgo(row.original.oldestAt)} ago` : ""}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "cashCollected",
      header: "Cash taken",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatMoney(row.original.cashCollected)}</span>
      ),
    },
    {
      accessorKey: "earnings",
      header: "Earned",
      cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.earnings)}</span>,
    },
    {
      accessorKey: "net",
      header: "Balance",
      cell: ({ row }) => {
        const { net } = row.original;

        return (
          <div className="flex flex-col">
            <span className="font-medium tabular-nums">{formatMoney(Math.abs(net))}</span>
            <span className="text-muted-foreground text-xs">
              {net >= 0 ? "rider owes us" : "we owe rider"}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            disabled={busy}
            onClick={() => setPending({ balance: row.original, type: "rider" })}
            size="sm"
            variant={row.original.net >= 0 ? "default" : "outline"}
          >
            {row.original.net >= 0 ? "Collect cash" : "Pay earnings"}
          </Button>
        </div>
      ),
    },
  ];

  const vendorColumns: DataTableColumns<VendorBalance> = [
    {
      accessorKey: "name",
      header: "Shop or kitchen",
      cell: ({ row }) => {
        const Icon = row.original.kind === "store" ? StoreIcon : UtensilsIcon;

        return (
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              <span className="text-muted-foreground text-xs">
                {row.original.orderCount} order{row.original.orderCount === 1 ? "" : "s"}
                {row.original.oldestAt ? ` · oldest ${formatAgo(row.original.oldestAt)} ago` : ""}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "goodsValue",
      header: "Goods sold",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatMoney(row.original.goodsValue)}</span>
      ),
    },
    {
      accessorKey: "commission",
      header: "Our commission",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatMoney(row.original.commission)}
        </span>
      ),
    },
    {
      accessorKey: "net",
      header: "We owe",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatMoney(row.original.net)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            disabled={busy}
            onClick={() => setPending({ balance: row.original, type: "vendor" })}
            size="sm"
          >
            Mark as paid
          </Button>
        </div>
      ),
    },
  ];

  const historyColumns: DataTableColumns<Settlement> = [
    {
      accessorKey: "partyName",
      header: "Settled with",
      cell: ({ row }) => {
        const Icon = PARTY_ICON[row.original.party];

        return (
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">{row.original.partyName}</span>
              <span className="text-muted-foreground text-xs">
                {row.original.orderCount} order{row.original.orderCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "direction",
      header: "Direction",
      cell: ({ row }) => (
        <Badge variant={row.original.direction === "incoming" ? "default" : "secondary"}>
          {row.original.direction === "incoming" ? "Received" : "Paid out"}
        </Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatMoney(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: "settledAt",
      header: "When",
      cell: ({ row }) => {
        const { date, time } = formatDateTime(row.original.settledAt);

        return (
          <div className="flex flex-col">
            <span className="text-sm">{date}</span>
            <span className="text-muted-foreground text-xs">{time}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "note",
      header: "Note",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-sm">{row.original.note || "—"}</span>
      ),
    },
  ];

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">Settlements</h1>
        <p className="text-muted-foreground text-sm">
          Cash your riders are holding, and what you owe your shops. Only delivered orders appear
          here — nothing in flight, nothing cancelled.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Figure
          hint="Collected at doors on delivered orders, less what those riders earned."
          label="Cash with riders"
          tone="in"
          value={totals?.cashWithRiders ?? 0}
        />
        <Figure
          hint="Riders carrying no cash to offset their earnings."
          label="Owed to riders"
          tone="out"
          value={totals?.owedToRiders ?? 0}
        />
        <Figure
          hint="Goods sold on delivered orders, after your commission."
          label="Owed to shops"
          tone="out"
          value={totals?.owedToVendors ?? 0}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BikeIcon className="text-muted-foreground size-4" />
            Riders
          </CardTitle>
          <CardDescription>
            A rider who took cash owes it to you, minus their earnings. A rider on prepaid work
            only is owed their earnings instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={riderColumns}
            data={data?.riders ?? []}
            emptyMessage="Every rider is square."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="text-muted-foreground size-4" />
            Shops and kitchens
          </CardTitle>
          <CardDescription>
            What each one is owed for goods it sold, whichever way the customer paid.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={vendorColumns}
            data={data?.vendors ?? []}
            emptyMessage="Every shop is paid up."
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <CardTitle>History</CardTitle>
          <Tabs
            onValueChange={(value) => setHistoryParty(value as Settlement["party"] | "all")}
            value={historyParty}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="rider">Riders</TabsTrigger>
              <TabsTrigger value="store">Shops</TabsTrigger>
              <TabsTrigger value="restaurant">Kitchens</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={historyColumns}
            data={history.data ?? []}
            emptyMessage="Nothing settled yet."
            isLoading={history.isLoading}
            paginated
          />
        </CardContent>
      </Card>

      <Dialog onOpenChange={(next) => (next ? undefined : close())} open={pending !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.type === "rider"
                ? pending.balance.net >= 0
                  ? `Collect ${formatMoney(pending.balance.net)} from ${pending.balance.name}?`
                  : `Pay ${formatMoney(-pending.balance.net)} to ${pending.balance.name}?`
                : pending
                  ? `Pay ${formatMoney(pending.balance.net)} to ${pending.balance.name}?`
                  : ""}
            </DialogTitle>
            <DialogDescription>
              {pending
                ? `This records ${pending.balance.orderCount} order${
                    pending.balance.orderCount === 1 ? "" : "s"
                  } as settled. Money moves outside Raket — confirm this once it has actually changed hands, because a settlement cannot be edited afterwards, only corrected by another one.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="settle-note">Note (optional)</Label>
            <Textarea
              id="settle-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="UPI reference, who handed it over, anything worth remembering"
              rows={3}
              value={note}
            />
          </div>

          <DialogFooter>
            <Button disabled={busy} onClick={close} variant="outline">
              Cancel
            </Button>
            <Button disabled={busy} onClick={confirm}>
              {busy ? <Spinner data-icon="inline-start" /> : null}
              Record it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
