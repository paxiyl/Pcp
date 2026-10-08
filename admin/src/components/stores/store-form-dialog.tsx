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
import { Textarea } from "@/components/ui/textarea";
import { useCreateStore, useUpdateStore } from "@/features/catalogue/use-catalogue";
import type { AdminStore } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that store". */
  store?: AdminStore;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  storeType: string;
  area: string;
  address: string;
  description: string;
  imageUrl: string;
  etaMinutes: string;
  deliveryFee: string;
  minOrder: string;
  freeDeliveryThreshold: string;
  closesAt: string;
  isOpen: boolean;
  isActive: boolean;
};

const EMPTY: FormState = {
  address: "",
  area: "",
  closesAt: "22:00",
  deliveryFee: "25",
  description: "",
  etaMinutes: "20",
  freeDeliveryThreshold: "",
  imageUrl: "",
  isActive: true,
  isOpen: true,
  minOrder: "99",
  name: "",
  storeType: "Kirana",
};

/**
 * Money is entered in RUPEES and stored in paise.
 *
 * The admin types what is printed on a price list, not a figure multiplied by a
 * hundred — asking someone to enter 2500 for a ₹25 delivery fee is how a shop
 * ends up charging ₹2,500 for one. The conversion happens here, once.
 */
const toPaise = (rupees: string): number => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise?: number): string =>
  paise === undefined || paise === null ? "" : String(paise / 100);

export function StoreFormDialog({ store, onOpenChange, open }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const create = useCreateStore();
  const update = useUpdateStore();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setForm(
      store
        ? {
            address: store.address,
            area: store.area,
            closesAt: store.closesAt,
            deliveryFee: toRupees(store.deliveryFee),
            description: store.description,
            etaMinutes: String(store.etaMinutes),
            freeDeliveryThreshold: toRupees(store.freeDeliveryThreshold),
            imageUrl: store.imageUrl,
            isActive: store.isActive,
            isOpen: store.isOpen,
            minOrder: toRupees(store.minOrder),
            name: store.name,
            storeType: store.storeType,
          }
        : EMPTY,
    );
  }, [open, store]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Enter a store name");

      return;
    }

    const payload = {
      address: form.address.trim(),
      area: form.area.trim(),
      closesAt: form.closesAt,
      deliveryFee: toPaise(form.deliveryFee),
      description: form.description.trim(),
      etaMinutes: Number(form.etaMinutes || 20),
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      isOpen: form.isOpen,
      minOrder: toPaise(form.minOrder),
      name: form.name.trim(),
      storeType: form.storeType.trim() || "Kirana",
      // Omitted rather than zero: zero means "free delivery from the first
      // rupee", which is a very different promise from "never free".
      ...(form.freeDeliveryThreshold
        ? { freeDeliveryThreshold: toPaise(form.freeDeliveryThreshold) }
        : {}),
    };

    try {
      if (store) {
        await update.mutateAsync({ id: store._id, ...payload });
        toast.success("Store updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Store added");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(apiMessage(error, "Could not save this store. Try again."));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{store ? "Edit store" : "Add store"}</DialogTitle>
          <DialogDescription>
            Fees and minimums are entered in rupees.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="store-name">Name</FieldLabel>
            <Input
              id="store-name"
              onChange={(event) => set("name", event.target.value)}
              placeholder="Sharma Kirana Store"
              value={form.name}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="store-type">Type</FieldLabel>
              <Input
                id="store-type"
                onChange={(event) => set("storeType", event.target.value)}
                placeholder="Kirana, Chemist, Dairy"
                value={form.storeType}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="store-area">Area</FieldLabel>
              <Input
                id="store-area"
                onChange={(event) => set("area", event.target.value)}
                placeholder="Bazaar, Katkad Road"
                value={form.area}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="store-address">Address</FieldLabel>
            <Input
              id="store-address"
              onChange={(event) => set("address", event.target.value)}
              placeholder="Bazaar Road, near Ghanta Ghar, Hindaun City"
              value={form.address}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="store-description">Description</FieldLabel>
            <Textarea
              id="store-description"
              onChange={(event) => set("description", event.target.value)}
              placeholder="What this shop is known for"
              rows={2}
              value={form.description}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="store-image">Logo URL</FieldLabel>
            <Input
              id="store-image"
              onChange={(event) => set("imageUrl", event.target.value)}
              placeholder="https://…"
              value={form.imageUrl}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="store-eta">Delivery ETA (minutes)</FieldLabel>
              <Input
                id="store-eta"
                inputMode="numeric"
                onChange={(event) => set("etaMinutes", event.target.value)}
                value={form.etaMinutes}
              />
              <FieldDescription>Shown as one number, not a range.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="store-closes">Closes at</FieldLabel>
              <Input
                id="store-closes"
                onChange={(event) => set("closesAt", event.target.value)}
                placeholder="22:00"
                value={form.closesAt}
              />
              <FieldDescription>24-hour time.</FieldDescription>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="store-fee">Delivery fee (₹)</FieldLabel>
              <Input
                id="store-fee"
                inputMode="decimal"
                onChange={(event) => set("deliveryFee", event.target.value)}
                value={form.deliveryFee}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="store-min">Minimum order (₹)</FieldLabel>
              <Input
                id="store-min"
                inputMode="decimal"
                onChange={(event) => set("minOrder", event.target.value)}
                value={form.minOrder}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="store-free">Free over (₹)</FieldLabel>
              <Input
                id="store-free"
                inputMode="decimal"
                onChange={(event) => set("freeDeliveryThreshold", event.target.value)}
                placeholder="Never"
                value={form.freeDeliveryThreshold}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="store-active">Listed</FieldLabel>
                <FieldDescription>Hidden stores disappear from the app.</FieldDescription>
              </div>
              <Switch
                checked={form.isActive}
                id="store-active"
                onCheckedChange={(value) => set("isActive", value)}
              />
            </Field>

            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="store-open">Open now</FieldLabel>
                <FieldDescription>Closed stores still appear, greyed.</FieldDescription>
              </div>
              <Switch
                checked={form.isOpen}
                id="store-open"
                onCheckedChange={(value) => set("isOpen", value)}
              />
            </Field>
          </div>
        </FieldGroup>

        <DialogFooter>
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? <Spinner className="size-4" /> : null}
            {store ? "Save changes" : "Add store"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
