import { BikeIcon, CheckIcon, StoreIcon, UtensilsIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type DataTableColumns } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useApplications, useReviewApplication } from "@/features/applications/use-applications";
import type { ApplicationStatus, PartnerApplication } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";
import { formatDateTime } from "@/lib/format";

const ROLE_LABEL: Record<PartnerApplication["requestedRole"], string> = {
  driver: "Delivery partner",
  restaurant_owner: "Restaurant",
  store_owner: "Shop",
};

const ROLE_ICON = {
  driver: BikeIcon,
  restaurant_owner: UtensilsIcon,
  store_owner: StoreIcon,
};

const applicant = (application: PartnerApplication) =>
  typeof application.userId === "string"
    ? { email: "", name: "Unknown", phone: undefined }
    : application.userId;

/**
 * People asking to become a shop, a kitchen or a rider.
 *
 * Approving is not a flag: it creates the shop or kitchen from the name on the
 * application and links the account to it, so a decision here is the whole of
 * onboarding rather than the first step of it.
 */
export function ApplicationsPage() {
  const [tab, setTab] = useState<ApplicationStatus>("pending");
  const [deciding, setDeciding] = useState<{
    application: PartnerApplication;
    status: "approved" | "rejected";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data, isLoading } = useApplications(tab);
  const review = useReviewApplication();

  const submit = () => {
    if (!deciding) return;

    review.mutate(
      {
        applicationId: deciding.application._id,
        reviewNote: reviewNote.trim() || undefined,
        status: deciding.status,
      },
      {
        onError: (error) => toast.error(apiMessage(error, "Could not record that decision.")),
        onSuccess: (response) => {
          toast.success(response.message);
          setDeciding(null);
          setReviewNote("");
        },
      },
    );
  };

  const columns: DataTableColumns<PartnerApplication> = [
    {
      accessorKey: "requestedRole",
      header: "Applying as",
      cell: ({ row }) => {
        const Icon = ROLE_ICON[row.original.requestedRole];

        return (
          <div className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4" />
            <span className="font-medium">{ROLE_LABEL[row.original.requestedRole]}</span>
          </div>
        );
      },
    },
    {
      id: "applicant",
      header: "Applicant",
      cell: ({ row }) => {
        const person = applicant(row.original);

        return (
          <div className="flex flex-col">
            <span className="font-medium">{person.name}</span>
            <span className="text-muted-foreground text-xs">{person.email}</span>
          </div>
        );
      },
    },
    {
      id: "business",
      header: "Business",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.businessName ?? "—"}</span>
          {row.original.area ? (
            <span className="text-muted-foreground text-xs">{row.original.area}</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => <span className="tabular-nums">{row.original.phone}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Applied",
      cell: ({ row }) => {
        const { date } = formatDateTime(row.original.createdAt);

        return <span className="text-muted-foreground text-sm">{date}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setDeciding({ application: row.original, status: "approved" })}
              size="sm"
            >
              <CheckIcon className="size-4" />
              Approve
            </Button>
            <Button
              onClick={() => setDeciding({ application: row.original, status: "rejected" })}
              size="sm"
              variant="outline"
            >
              <XIcon className="size-4" />
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Badge variant={row.original.status === "approved" ? "default" : "secondary"}>
              {row.original.status === "approved" ? "Approved" : "Rejected"}
            </Badge>
          </div>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl">Partner applications</h1>
        <p className="text-muted-foreground text-sm">
          Shops, kitchens and riders asking to join. Approving creates their shop or kitchen and
          links their account to it.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Queue</CardTitle>
          <Tabs onValueChange={(value) => setTab(value as ApplicationStatus)} value={tab}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data ?? []}
            emptyMessage={
              tab === "pending" ? "Nobody is waiting on a decision." : `No ${tab} applications.`
            }
            isLoading={isLoading}
            paginated
          />
        </CardContent>
      </Card>

      <Dialog onOpenChange={(open) => !open && setDeciding(null)} open={deciding !== null}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deciding?.status === "approved" ? "Approve application" : "Reject application"}
            </DialogTitle>
            <DialogDescription>
              {deciding?.status === "approved"
                ? deciding.application.requestedRole === "driver"
                  ? "This account becomes a delivery partner and can start taking deliveries."
                  : `This creates "${deciding?.application.businessName}" and links the account to it.`
                : "The applicant can be told why. This does not stop them applying again."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reviewNote">
              {deciding?.status === "approved" ? "Note (optional)" : "Reason (optional)"}
            </Label>
            <Textarea
              id="reviewNote"
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder={
                deciding?.status === "approved"
                  ? "Anything to record about this decision"
                  : "Shown to the applicant"
              }
              value={reviewNote}
            />
          </div>

          <DialogFooter>
            <Button onClick={() => setDeciding(null)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={review.isPending}
              onClick={submit}
              variant={deciding?.status === "rejected" ? "destructive" : "default"}
            >
              {deciding?.status === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
