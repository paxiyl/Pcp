import { ImageIcon, StarIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import {
  useCreateRestaurant,
  useUpdateRestaurant,
} from "@/features/restaurants/use-admin-restaurants";
import { useUploadImage } from "@/features/uploads/use-upload-image";
import type { AdminRestaurantProfile } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that restaurant". */
  restaurant?: AdminRestaurantProfile;
  defaultCommissionRate: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  address: string;
  cuisines: string;
  imageUrl: string;
  description: string;
  prepMin: string;
  prepMax: string;
  deliveryFee: string;
  minOrder: string;
  commissionRate: string;
  rating: string;
  ratingCount: string;
  freeDeliveryThreshold: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
  isOpen: boolean;
};

/** Money is stored in cents; the form works in whole currency. */
const toMinor = (value: string) => Math.round(Number(value || 0) * 100);
const toMajor = (cents: number) => (cents / 100).toFixed(2);

const emptyForm: FormState = {
  address: "",
  commissionRate: "",
  cuisines: "",
  deliveryFee: "4.90",
  description: "",
  imageUrl: "",
  freeDeliveryThreshold: "",
  isActive: true,
  isOpen: true,
  latitude: "",
  longitude: "",
  minOrder: "0.00",
  name: "",
  prepMax: "30",
  prepMin: "20",
  rating: "0",
  ratingCount: "0",
};

export function RestaurantFormDialog({
  restaurant,
  defaultCommissionRate,
  onOpenChange,
  open,
}: Props) {
  const create = useCreateRestaurant();
  const update = useUpdateRestaurant();
  const uploadImage = useUploadImage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reload whenever the dialog opens so a previous edit never leaks into it.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setForm(
      restaurant
        ? {
            address: restaurant.address,
            commissionRate:
              restaurant.commissionRate === undefined
                ? ""
                : String(Math.round(restaurant.commissionRate * 100)),
            cuisines: restaurant.cuisines.join(", "),
            deliveryFee: toMajor(restaurant.deliveryFee),
            description: restaurant.description,
            imageUrl: restaurant.imageUrl,
            freeDeliveryThreshold: restaurant.freeDeliveryThreshold
              ? toMajor(restaurant.freeDeliveryThreshold)
              : "",
            isActive: restaurant.isActive,
            isOpen: restaurant.isOpen,
            latitude: restaurant.location ? String(restaurant.location.coordinates[1]) : "",
            longitude: restaurant.location ? String(restaurant.location.coordinates[0]) : "",
            minOrder: toMajor(restaurant.minOrder),
            name: restaurant.name,
            prepMax: String(restaurant.prepTimeMaxMinutes),
            prepMin: String(restaurant.prepTimeMinMinutes),
            rating: String(restaurant.rating),
            ratingCount: String(restaurant.ratingCount),
          }
        : emptyForm,
    );
  }, [open, restaurant]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const pickImage = (file?: File) => {
    if (!file) return;

    uploadImage.mutate(
      { file, folder: "restaurants" },
      {
        onError: (error) =>
          toast.error("Upload failed", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        onSuccess: (response) => set("imageUrl", response.data.url),
      },
    );
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = "Enter a restaurant name";
    if (Number(form.prepMax) < Number(form.prepMin)) {
      nextErrors.prepMax = "Maximum must be at least the minimum";
    }
    if (form.commissionRate && (Number(form.commissionRate) < 0 || Number(form.commissionRate) > 50)) {
      nextErrors.commissionRate = "Commission must be between 0 and 50%";
    }
    if (Number(form.rating) < 0 || Number(form.rating) > 5) {
      nextErrors.rating = "Rating is out of 5";
    }
    if (Boolean(form.latitude) !== Boolean(form.longitude)) {
      nextErrors.latitude = "Enter both latitude and longitude, or neither";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      address: form.address.trim(),
      name: form.name.trim(),
      cuisines: form.cuisines
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      deliveryFee: toMinor(form.deliveryFee),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      minOrder: toMinor(form.minOrder),
      prepTimeMaxMinutes: Number(form.prepMax),
      prepTimeMinMinutes: Number(form.prepMin),
      rating: Number(form.rating),
      ratingCount: Number(form.ratingCount),
      isOpen: form.isOpen,
      ...(form.commissionRate ? { commissionRate: Number(form.commissionRate) / 100 } : {}),
      ...(form.freeDeliveryThreshold
        ? { freeDeliveryThreshold: toMinor(form.freeDeliveryThreshold) }
        : {}),
      ...(form.latitude && form.longitude
        ? { latitude: Number(form.latitude), longitude: Number(form.longitude) }
        : {}),
    };

    const onError = (error: Error) =>
      toast.error("Could not save the restaurant", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });

    const onSuccess = () => {
      toast.success(restaurant ? `${form.name} updated` : `${form.name} added`);
      onOpenChange(false);
    };

    if (restaurant) {
      update.mutate({ id: restaurant._id, ...input }, { onError, onSuccess });
    } else {
      create.mutate(input, { onError, onSuccess });
    }
  };

  return (
  <Dialog onOpenChange={onOpenChange} open={open}>
  <DialogContent className="px-0! max-h-[90svh] h-full gap-0! sm:max-w-lg flex flex-col">
    <form className="flex h-full min-h-0 flex-col" onSubmit={submit} noValidate>
      <DialogHeader className="shrink-0 px-4 pb-2">
        <DialogTitle className="text-2xl! font-bold">
          {restaurant ? "Edit restaurant" : "Add restaurant"}
        </DialogTitle>
        <DialogDescription>
          {restaurant
            ? "Update the profile, delivery terms and commission."
            : "Create a restaurant profile. Dishes are added from its menu afterwards."}
        </DialogDescription>
      </DialogHeader>
            
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4 sm:pt-4">
          <FieldGroup>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                aria-invalid={errors.name ? true : undefined}
                id="name"
                onChange={(event) => set("name", event.target.value)}
                placeholder="Bella Italia"
                value={form.name}
              />
              {errors.name ? <FieldDescription>{errors.name}</FieldDescription> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Input
                id="address"
                onChange={(event) => set("address", event.target.value)}
                placeholder="3 Hoe Street, London E17"
                value={form.address}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="cuisines">Cuisines</FieldLabel>
              <Input
                id="cuisines"
                onChange={(event) => set("cuisines", event.target.value)}
                placeholder="Italian, Pizza, Pasta"
                value={form.cuisines}
              />
              <FieldDescription>Separate with commas.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Cover image</FieldLabel>

              <div className="flex items-center gap-4">
                {form.imageUrl ? (
                  <img
                    alt=""
                    className="h-24 w-40 rounded-lg border object-cover"
                    src={form.imageUrl}
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-24 w-40 items-center justify-center rounded-lg border">
                    <ImageIcon className="size-6" />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <input
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className="hidden"
                    onChange={(event) => pickImage(event.target.files?.[0])}
                    ref={fileInput}
                    type="file"
                  />

                  <Button
                    disabled={uploadImage.isPending}
                    onClick={() => fileInput.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    {uploadImage.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <UploadIcon data-icon="inline-start" />
                    )}
                    {form.imageUrl ? "Replace image" : "Upload image"}
                  </Button>

                  {form.imageUrl ? (
                    <Button
                      onClick={() => set("imageUrl", "")}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <FieldDescription>PNG, JPG, WebP or AVIF, up to 5 MB.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                onChange={(event) => set("description", event.target.value)}
                placeholder="Wood-fired pizza and fresh pasta."
                rows={2}
                value={form.description}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="prepMin">Prep time from (min)</FieldLabel>
                <Input
                  id="prepMin"
                  min={0}
                  onChange={(event) => set("prepMin", event.target.value)}
                  type="number"
                  value={form.prepMin}
                />
              </Field>

              <Field data-invalid={errors.prepMax ? true : undefined}>
                <FieldLabel htmlFor="prepMax">Prep time to (min)</FieldLabel>
                <Input
                  aria-invalid={errors.prepMax ? true : undefined}
                  id="prepMax"
                  min={0}
                  onChange={(event) => set("prepMax", event.target.value)}
                  type="number"
                  value={form.prepMax}
                />
                {errors.prepMax ? <FieldDescription>{errors.prepMax}</FieldDescription> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="deliveryFee">Delivery fee ($)</FieldLabel>
                <Input
                  id="deliveryFee"
                  min={0}
                  onChange={(event) => set("deliveryFee", event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.deliveryFee}
                />
                <FieldDescription>Should cover the rider's base pay.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="minOrder">Minimum order ($)</FieldLabel>
                <Input
                  id="minOrder"
                  min={0}
                  onChange={(event) => set("minOrder", event.target.value)}
                  step="0.01"
                  type="number"
                  value={form.minOrder}
                />
              </Field>
            </div>

            <Field data-invalid={errors.commissionRate ? true : undefined}>
              <FieldLabel htmlFor="commissionRate">Commission (%)</FieldLabel>
              <Input
                aria-invalid={errors.commissionRate ? true : undefined}
                id="commissionRate"
                max={50}
                min={0}
                onChange={(event) => set("commissionRate", event.target.value)}
                placeholder={String(Math.round(defaultCommissionRate * 100))}
                type="number"
                value={form.commissionRate}
              />
              <FieldDescription>
                {errors.commissionRate ??
                  `Leave blank to use the platform rate (${Math.round(defaultCommissionRate * 100)}%).`}
              </FieldDescription>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.rating ? true : undefined}>
                <FieldLabel htmlFor="rating">Rating</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    aria-invalid={errors.rating ? true : undefined}
                    id="rating"
                    max={5}
                    min={0}
                    onChange={(event) => set("rating", event.target.value)}
                    step="0.1"
                    type="number"
                    value={form.rating}
                  />
                  <StarIcon className="size-4 shrink-0 fill-amber-500 text-amber-500" />
                </div>
                <FieldDescription>
                  {errors.rating ?? "Out of 5. Ratings are admin-managed, not user reviews."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="ratingCount">Rating count</FieldLabel>
                <Input
                  id="ratingCount"
                  min={0}
                  onChange={(event) => set("ratingCount", event.target.value)}
                  type="number"
                  value={form.ratingCount}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="freeDeliveryThreshold">Free delivery over ($)</FieldLabel>
              <Input
                id="freeDeliveryThreshold"
                min={0}
                onChange={(event) => set("freeDeliveryThreshold", event.target.value)}
                step="0.01"
                type="number"
                value={form.freeDeliveryThreshold}
              />
              <FieldDescription>
                Leave blank to always charge delivery. The platform absorbs the rider's pay on
                free-delivery orders.
              </FieldDescription>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={errors.latitude ? true : undefined}>
                <FieldLabel htmlFor="latitude">Latitude</FieldLabel>
                <Input
                  aria-invalid={errors.latitude ? true : undefined}
                  id="latitude"
                  onChange={(event) => set("latitude", event.target.value)}
                  placeholder="51.5836"
                  step="any"
                  type="number"
                  value={form.latitude}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="longitude">Longitude</FieldLabel>
                <Input
                  id="longitude"
                  onChange={(event) => set("longitude", event.target.value)}
                  placeholder="-0.0197"
                  step="any"
                  type="number"
                  value={form.longitude}
                />
              </Field>
            </div>

            <FieldDescription>
              {errors.latitude ??
                "Used for rider distance pay and the customer's tracking map. A map picker needs a browser Maps key; these accept coordinates directly."}
            </FieldDescription>

            <Field orientation="horizontal">
              <Switch
                checked={form.isOpen}
                id="isOpen"
                onCheckedChange={(value) => set("isOpen", value)}
              />
              <FieldLabel htmlFor="isOpen">
                Accepting orders — pause without hiding the restaurant
              </FieldLabel>
            </Field>

            <Field orientation="horizontal">
              <Switch
                checked={form.isActive}
                id="isActive"
                onCheckedChange={(value) => set("isActive", value)}
              />
              <FieldLabel htmlFor="isActive">
                Active — visible to customers in the app
              </FieldLabel>
            </Field>
          </FieldGroup>

          </div>

         <DialogFooter className="shrink-0 mt-0 w-full! px-4! mx-0! border-t py-3">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {restaurant ? "Save changes" : "Add restaurant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
