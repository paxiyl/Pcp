import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useCreateRider, useUpdateRider } from "@/features/riders/use-admin-riders";
import type { AdminRider } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that rider". */
  rider?: AdminRider;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  approved: boolean;
};

const emptyForm: FormState = {
  approved: true,
  email: "",
  name: "",
  password: "",
  phone: "",
};

export function RiderFormDialog({ rider, onOpenChange, open }: Props) {
  const create = useCreateRider();
  const update = useUpdateRider();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reload on open so a previous edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setForm(
      rider
        ? {
            approved: rider.driverStatus === "approved",
            email: rider.email,
            name: rider.name,
            password: "",
            phone: rider.phone ?? "",
          }
        : emptyForm,
    );
  }, [open, rider]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter the rider's name";
    if (!rider && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email";
    }
    if (!rider && form.password.length < 8) {
      nextErrors.password = "Use at least 8 characters";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const onError = (error: Error) =>
      toast.error("Could not save the rider", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });

    const onSuccess = () => {
      toast.success(rider ? `${form.name} updated` : `${form.name} added`);
      onOpenChange(false);
    };

    if (rider) {
      update.mutate(
        {
          id: rider._id,
          name: form.name.trim(),
          phone: form.phone.trim(),
          // Suspending from here would hide why, so approval only toggles
          // between approved and pending; the row menu owns suspension.
          ...(form.approved !== (rider.driverStatus === "approved")
            ? { driverStatus: form.approved ? ("approved" as const) : ("pending" as const) }
            : {}),
        },
        { onError, onSuccess },
      );

      return;
    }

    create.mutate(
      {
        driverStatus: form.approved ? "approved" : "pending",
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        phone: form.phone.trim(),
      },
      { onError, onSuccess },
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {/* The body scrolls; the title and the actions stay put. */}
      <DialogContent className="flex max-h-[90svh] flex-col gap-0! px-0! sm:max-w-lg">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
          <DialogHeader className="shrink-0 px-6 pb-2">
            <DialogTitle className="text-2xl! font-bold">
              {rider ? "Edit rider" : "Add rider"}
            </DialogTitle>
            <DialogDescription>
              {rider
                ? "Update the rider's contact details and approval."
                : "Create a rider account. They sign in to the Raket delivery app with this email."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4 sm:pt-4">
            <FieldGroup>
              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="rider-name">Full name</FieldLabel>
                <Input
                  aria-invalid={errors.name ? true : undefined}
                  id="rider-name"
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Tunde Adebayo"
                  value={form.name}
                />
                {errors.name ? <FieldDescription>{errors.name}</FieldDescription> : null}
              </Field>

              <Field data-invalid={errors.email ? true : undefined}>
                <FieldLabel htmlFor="rider-email">Email</FieldLabel>
                <Input
                  aria-invalid={errors.email ? true : undefined}
                  autoComplete="off"
                  disabled={Boolean(rider)}
                  id="rider-email"
                  onChange={(event) => set("email", event.target.value)}
                  placeholder="rider@example.com"
                  type="email"
                  value={form.email}
                />
                <FieldDescription>
                  {errors.email ?? (rider ? "The sign-in email cannot be changed." : "")}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="rider-phone">Phone</FieldLabel>
                <Input
                  id="rider-phone"
                  onChange={(event) => set("phone", event.target.value)}
                  placeholder="+44 7700 900501"
                  value={form.phone}
                />
                <FieldDescription>Shown to the customer while they are delivering.</FieldDescription>
              </Field>

              {rider ? null : (
                <Field data-invalid={errors.password ? true : undefined}>
                  <FieldLabel htmlFor="rider-password">Temporary password</FieldLabel>
                  <Input
                    aria-invalid={errors.password ? true : undefined}
                    autoComplete="new-password"
                    id="rider-password"
                    onChange={(event) => set("password", event.target.value)}
                    type="text"
                    value={form.password}
                  />
                  <FieldDescription>
                    {errors.password ?? "At least 8 characters. Share it with the rider directly."}
                  </FieldDescription>
                </Field>
              )}

              <Field orientation="horizontal">
                <Switch
                  checked={form.approved}
                  id="rider-approved"
                  onCheckedChange={(value) => set("approved", value)}
                />
                <FieldLabel htmlFor="rider-approved">
                  Approved — may go online and claim deliveries
                </FieldLabel>
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="mx-0! mt-0 w-full! shrink-0 border-t px-6! py-3">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {rider ? "Save changes" : "Add rider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
