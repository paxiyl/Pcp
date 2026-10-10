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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useCreateStoreOwner,
  useUpdateStoreOwner,
} from "@/features/catalogue/use-store-owners";
import type { AdminStore, StoreOwnerRow } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that account". */
  owner?: StoreOwnerRow;
  stores: AdminStore[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function StoreOwnerFormDialog({ owner, stores, onOpenChange, open }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const create = useCreateStoreOwner();
  const update = useUpdateStoreOwner();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setName(owner?.name ?? "");
    setEmail(owner?.email ?? "");
    setPhone(owner?.phone ?? "");
    setStoreId(owner?.store?._id ?? "");
    setIsActive(owner?.isActive ?? true);
    // Never prefilled, and never sent on an edit: a password reset is its own
    // flow, not a field that silently resets when someone fixes a phone number.
    setPassword("");
  }, [open, owner]);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Enter the owner's name");
    if (!storeId) return toast.error("Choose the shop this account will run");

    try {
      if (owner) {
        await update.mutateAsync({
          isActive,
          name: name.trim(),
          ownerId: owner._id,
          phone: phone.trim() || undefined,
          storeId,
        });
        toast.success("Store owner updated");
      } else {
        if (!email.trim()) return toast.error("Enter an email address");
        if (password.length < 8) return toast.error("Use at least 8 characters for the password");

        await create.mutateAsync({
          email: email.trim(),
          name: name.trim(),
          password,
          phone: phone.trim() || undefined,
          storeId,
        });
        toast.success("Store owner created");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(apiMessage(error, "Could not save this account. Try again."));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{owner ? "Edit store owner" : "Add store owner"}</DialogTitle>
          <DialogDescription>
            They sign in on the Raket app and pick "Store owner".
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="owner-name">Name</FieldLabel>
            <Input
              id="owner-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Mahesh Sharma"
              value={name}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="owner-store">Shop</FieldLabel>
            <Select onValueChange={setStoreId} value={storeId}>
              <SelectTrigger id="owner-store">
                <SelectValue placeholder="Choose a shop" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {stores.map((store) => (
                    <SelectItem key={store._id} value={store._id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              One shop per owner. Moving an owner to another shop is allowed; two owners on
              one shop is not.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="owner-email">Email</FieldLabel>
            <Input
              disabled={Boolean(owner)}
              id="owner-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@sharmakirana.in"
              type="email"
              value={email}
            />
            {owner ? (
              <FieldDescription>
                The sign-in address cannot be changed here — that is an identity change.
              </FieldDescription>
            ) : null}
          </Field>

          <Field>
            <FieldLabel htmlFor="owner-phone">Phone</FieldLabel>
            <Input
              id="owner-phone"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98290 00000"
              value={phone}
            />
          </Field>

          {owner ? (
            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="owner-active">Active</FieldLabel>
                <FieldDescription>Deactivating blocks sign-in immediately.</FieldDescription>
              </div>
              <Switch checked={isActive} id="owner-active" onCheckedChange={setIsActive} />
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="owner-password">Temporary password</FieldLabel>
              <Input
                id="owner-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                type="text"
                value={password}
              />
              <FieldDescription>
                Shown in plain text on purpose: you have to read it out to them. Ask them to
                change it after the first sign-in.
              </FieldDescription>
            </Field>
          )}
        </FieldGroup>

        <DialogFooter>
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? <Spinner className="size-4" /> : null}
            {owner ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
