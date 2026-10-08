import { ImageIcon, UploadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DishOptionGroups,
  toApiGroups,
  toEditableGroups,
  validateGroups,
  type EditableGroup,
} from "@/components/restaurants/dish-option-groups";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/features/categories/use-categories";
import { useCreateDish, useUpdateDish } from "@/features/restaurants/use-dishes";
import { useUploadImage } from "@/features/uploads/use-upload-image";
import type { AdminDish } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that dish". */
  dish?: AdminDish;
  restaurantId: string;
  restaurantName: string;
  /** Sections this menu already uses, so an existing dish keeps its own. */
  sections: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  section: string;
  isAvailable: boolean;
  isPopular: boolean;
};

const toMinor = (value: string) => Math.round(Number(value || 0) * 100);
const toMajor = (cents: number) => (cents / 100).toFixed(2);

const emptyForm: FormState = {
  description: "",
  imageUrl: "",
  isAvailable: true,
  isPopular: false,
  name: "",
  price: "0.00",
  section: "",
};

export function DishFormDialog({
  dish,
  restaurantId,
  restaurantName,
  sections,
  onOpenChange,
  open,
}: Props) {
  const create = useCreateDish();
  const update = useUpdateDish();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * The catalogue drives the list, but a dish filed under a section that predates
   * it must still show its own value rather than silently jumping category.
   */
  const categoryOptions = useMemo(() => {
    const fromCatalogue = (categories ?? []).map((category) => category.name);

    return [...new Set([...fromCatalogue, ...sections, ...(dish ? [dish.section] : [])])].filter(
      Boolean,
    );
  }, [categories, dish, sections]);

  // Reload on open so a previous edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setForm(
      dish
        ? {
            description: dish.description,
            imageUrl: dish.imageUrl,
            isAvailable: dish.isAvailable,
            isPopular: dish.isPopular,
            name: dish.name,
            price: toMajor(dish.price),
            section: dish.section,
          }
        : emptyForm,
    );
    setGroups(dish ? toEditableGroups(dish.optionGroups) : []);
  }, [dish, open]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const pickImage = (file?: File) => {
    if (!file) return;

    uploadImage.mutate(
      { file, folder: "dishes" },
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
    if (form.name.trim().length < 2) nextErrors.name = "Enter a dish name";
    if (!form.section.trim()) nextErrors.section = "Pick a category";
    if (Number(form.price) < 0) nextErrors.price = "Price cannot be negative";

    const groupError = validateGroups(groups);
    if (groupError) nextErrors.optionGroups = groupError;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      isAvailable: form.isAvailable,
      isPopular: form.isPopular,
      name: form.name.trim(),
      price: toMinor(form.price),
      optionGroups: toApiGroups(groups),
      section: form.section.trim(),
    };

    const onError = (error: Error) =>
      toast.error("Could not save the dish", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });

    const onSuccess = () => {
      toast.success(dish ? `${form.name} updated` : `${form.name} added`);
      onOpenChange(false);
    };

    if (dish) {
      update.mutate({ id: dish._id, ...input }, { onError, onSuccess });
    } else {
      create.mutate({ restaurantId, ...input }, { onError, onSuccess });
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {/* The body scrolls; the title and the actions stay put. */}
      <DialogContent className="flex max-h-[90svh] flex-col gap-0! px-0! sm:max-w-lg">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
          <DialogHeader className="shrink-0 px-6 pb-2">
            <DialogTitle className="text-2xl! font-bold">
              {dish ? "Edit dish" : "Add dish"}
            </DialogTitle>
            <DialogDescription>
              {dish
                ? `Update this dish on ${restaurantName}.`
                : `Add a new dish to ${restaurantName}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4 sm:pt-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Dish image</FieldLabel>

                <input
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => pickImage(event.target.files?.[0])}
                  ref={fileInput}
                  type="file"
                />

                <div className="flex items-center gap-4">
                  {form.imageUrl ? (
                    <img
                      alt=""
                      className="size-28 rounded-lg border object-cover"
                      src={form.imageUrl}
                    />
                  ) : (
                    <button
                      className="text-muted-foreground hover:border-primary hover:text-primary flex h-28 w-56 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors"
                      disabled={uploadImage.isPending}
                      onClick={() => fileInput.current?.click()}
                      type="button"
                    >
                      {uploadImage.isPending ? (
                        <Spinner className="size-5" />
                      ) : (
                        <ImageIcon className="size-5" />
                      )}
                      <span className="text-foreground text-sm font-medium">Upload image</span>
                      <span className="text-xs">PNG or JPG · Max 5 MB</span>
                    </button>
                  )}

                  {form.imageUrl ? (
                    <div className="flex flex-col gap-2">
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
                        Replace image
                      </Button>
                      <Button
                        onClick={() => set("imageUrl", "")}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Field>

              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="dish-name">Dish name</FieldLabel>
                <Input
                  aria-invalid={errors.name ? true : undefined}
                  id="dish-name"
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Jollof Rice & Grilled Chicken"
                  value={form.name}
                />
                {errors.name ? <FieldDescription>{errors.name}</FieldDescription> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="dish-description">Description</FieldLabel>
                <Textarea
                  id="dish-description"
                  onChange={(event) => set("description", event.target.value)}
                  placeholder="Smoky jollof rice served with grilled chicken and fresh slaw."
                  rows={3}
                  value={form.description}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.section ? true : undefined}>
                  <FieldLabel htmlFor="dish-section">Category</FieldLabel>
                  <Select onValueChange={(value) => set("section", value)} value={form.section}>
                    <SelectTrigger
                      aria-invalid={errors.section ? true : undefined}
                      id="dish-section"
                    >
                      <SelectValue placeholder="Pick a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {errors.section ? <FieldDescription>{errors.section}</FieldDescription> : null}
                </Field>

                <Field data-invalid={errors.price ? true : undefined}>
                  <FieldLabel htmlFor="dish-price">Price</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>$</InputGroupAddon>
                    <InputGroupInput
                      aria-invalid={errors.price ? true : undefined}
                      id="dish-price"
                      min={0}
                      onChange={(event) => set("price", event.target.value)}
                      step="0.01"
                      type="number"
                      value={form.price}
                    />
                  </InputGroup>
                  {errors.price ? <FieldDescription>{errors.price}</FieldDescription> : null}
                </Field>
              </div>

              <Field orientation="horizontal">
                <Switch
                  checked={form.isAvailable}
                  id="dish-available"
                  onCheckedChange={(value) => set("isAvailable", value)}
                />
                <FieldLabel htmlFor="dish-available">Available for ordering</FieldLabel>
              </Field>

              <Field orientation="horizontal">
                <Switch
                  checked={form.isPopular}
                  id="dish-popular"
                  onCheckedChange={(value) => set("isPopular", value)}
                />
                <FieldLabel htmlFor="dish-popular">Show in the Popular row</FieldLabel>
              </Field>

              <Field data-invalid={errors.optionGroups ? true : undefined}>
                <DishOptionGroups onChange={setGroups} value={groups} />
                {errors.optionGroups ? (
                  <FieldDescription>{errors.optionGroups}</FieldDescription>
                ) : null}
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="mx-0! mt-0 w-full! shrink-0 border-t px-6! py-3">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {dish ? "Save changes" : "Add dish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
