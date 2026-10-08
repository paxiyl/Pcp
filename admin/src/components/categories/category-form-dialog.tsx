import { ImageIcon, UploadIcon } from "lucide-react";
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
import { useCreateCategory, useUpdateCategory } from "@/features/categories/use-admin-categories";
import { useUploadImage } from "@/features/uploads/use-upload-image";
import type { AdminCategory } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that category". */
  category?: AdminCategory;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  imageUrl: string;
  backgroundColor: string;
  isActive: boolean;
};

const DEFAULT_TINT = "#F3F6F5";

const emptyForm: FormState = {
  backgroundColor: DEFAULT_TINT,
  imageUrl: "",
  isActive: true,
  name: "",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function CategoryFormDialog({ category, onOpenChange, open }: Props) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const uploadImage = useUploadImage();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reload on open so a previous edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setForm(
      category
        ? {
            backgroundColor: category.backgroundColor,
            imageUrl: category.imageUrl,
            isActive: category.isActive,
            name: category.name,
          }
        : emptyForm,
    );
  }, [category, open]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const pickImage = (file?: File) => {
    if (!file) return;

    uploadImage.mutate(
      { file, folder: "categories" },
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
    if (form.name.trim().length < 2) nextErrors.name = "Enter a category name";
    if (!/^#[0-9a-f]{6}$/i.test(form.backgroundColor)) {
      nextErrors.backgroundColor = "Use a hex colour such as #FFE9D6";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      backgroundColor: form.backgroundColor,
      imageUrl: form.imageUrl.trim(),
      isActive: form.isActive,
      name: form.name.trim(),
    };

    const onError = (error: Error) =>
      toast.error("Could not save the category", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });

    const onSuccess = () => {
      toast.success(category ? `${form.name} updated` : `${form.name} added`);
      onOpenChange(false);
    };

    if (category) {
      update.mutate({ id: category._id, ...input }, { onError, onSuccess });
    } else {
      create.mutate(input, { onError, onSuccess });
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {/* The body scrolls; the title and the actions stay put. */}
      <DialogContent className="flex max-h-[90svh] flex-col gap-0! px-0! sm:max-w-lg">
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit} noValidate>
          <DialogHeader className="shrink-0 px-6 pb-2">
            <DialogTitle className="text-2xl! font-bold">
              {category ? "Edit category" : "Add category"}
            </DialogTitle>
            <DialogDescription>
              {category
                ? "Update how this category appears in the app."
                : "Categories are the row customers browse at the top of the home screen."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4 sm:pt-4">
            <FieldGroup>
              <Field>
                <FieldLabel>Category image</FieldLabel>

                <input
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => pickImage(event.target.files?.[0])}
                  ref={fileInput}
                  type="file"
                />

                <div className="flex items-center gap-4">
                  {form.imageUrl ? (
                    <div
                      className="flex size-28 shrink-0 items-center justify-center rounded-lg border"
                      style={{ backgroundColor: form.backgroundColor }}
                    >
                      <img alt="" className="size-20 object-contain" src={form.imageUrl} />
                    </div>
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

                <FieldDescription>
                  Shown on the tint below, so a transparent PNG works best.
                </FieldDescription>
              </Field>

              <Field data-invalid={errors.name ? true : undefined}>
                <FieldLabel htmlFor="category-name">Name</FieldLabel>
                <Input
                  aria-invalid={errors.name ? true : undefined}
                  id="category-name"
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Pizza"
                  value={form.name}
                />
                {errors.name ? <FieldDescription>{errors.name}</FieldDescription> : null}
              </Field>

              <Field data-disabled>
                <FieldLabel htmlFor="category-slug">Slug</FieldLabel>
                <Input
                  disabled
                  id="category-slug"
                  placeholder="pizza"
                  readOnly
                  value={slugify(form.name)}
                />
                <FieldDescription>
                  Generated from the name and kept unique by the server, which adds a number if
                  the slug is already taken.
                </FieldDescription>
              </Field>

              <Field data-invalid={errors.backgroundColor ? true : undefined}>
                <FieldLabel htmlFor="category-tint">Background tint</FieldLabel>

                <div className="flex items-center gap-3">
                  <input
                    aria-label="Pick a tint"
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent"
                    onChange={(event) => set("backgroundColor", event.target.value)}
                    type="color"
                    value={form.backgroundColor}
                  />
                  <Input
                    aria-invalid={errors.backgroundColor ? true : undefined}
                    id="category-tint"
                    onChange={(event) => set("backgroundColor", event.target.value)}
                    placeholder={DEFAULT_TINT}
                    value={form.backgroundColor}
                  />
                </div>

                <FieldDescription>
                  {errors.backgroundColor ?? "Sits behind the image on the home row."}
                </FieldDescription>
              </Field>

              <Field orientation="horizontal">
                <Switch
                  checked={form.isActive}
                  id="category-active"
                  onCheckedChange={(value) => set("isActive", value)}
                />
                <FieldLabel htmlFor="category-active">Active — visible in the app</FieldLabel>
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="mx-0! mt-0 w-full! shrink-0 border-t px-6! py-3">
            <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={pending} type="submit">
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {category ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
