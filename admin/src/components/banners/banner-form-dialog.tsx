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
import { useCreateBanner, useUpdateBanner } from "@/features/banners/use-banners";
import { useCategories } from "@/features/categories/use-categories";
import { useUploadImage } from "@/features/uploads/use-upload-image";
import type { AdminBanner } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  /** Absent means "create"; present means "edit that banner". */
  banner?: AdminBanner;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  categorySlug: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const NO_CATEGORY = "none";

const emptyForm: FormState = {
  categorySlug: NO_CATEGORY,
  endsAt: "",
  imageUrl: "",
  isActive: true,
  startsAt: "",
  subtitle: "",
  title: "",
};

/** <input type="date"> wants YYYY-MM-DD; the API sends a full ISO string. */
const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function BannerFormDialog({ banner, onOpenChange, open }: Props) {
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories();
  const fileInput = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reload on open so a previous edit never leaks into the next one.
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setForm(
      banner
        ? {
            categorySlug: banner.categorySlug || NO_CATEGORY,
            endsAt: toDateInput(banner.endsAt),
            imageUrl: banner.imageUrl,
            isActive: banner.isActive,
            startsAt: toDateInput(banner.startsAt),
            subtitle: banner.subtitle,
            title: banner.title,
          }
        : emptyForm,
    );
  }, [banner, open]);

  const set = (key: keyof FormState, value: string | boolean) =>
    setForm((current) => ({ ...current, [key]: value }));

  const pending = create.isPending || update.isPending;

  const pickImage = (file?: File) => {
    if (!file) return;

    uploadImage.mutate(
      { file, folder: "banners" },
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
    if (form.title.trim().length < 2) nextErrors.title = "Enter a banner title";
    if (!form.imageUrl) nextErrors.imageUrl = "A banner needs artwork";
    if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      nextErrors.endsAt = "The end date is before the start date";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      // Empty strings clear the dates and the link on the server.
      categorySlug: form.categorySlug === NO_CATEGORY ? "" : form.categorySlug,
      endsAt: form.endsAt,
      imageUrl: form.imageUrl,
      isActive: form.isActive,
      startsAt: form.startsAt,
      subtitle: form.subtitle.trim(),
      title: form.title.trim(),
    };

    const onError = (error: Error) =>
      toast.error("Could not save the banner", {
        description: error instanceof ApiError ? error.message : "Please try again.",
      });

    const onSuccess = () => {
      toast.success(banner ? `${form.title} updated` : `${form.title} added`);
      onOpenChange(false);
    };

    if (banner) {
      update.mutate({ id: banner._id, ...input }, { onError, onSuccess });
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
              {banner ? "Edit banner" : "Add banner"}
            </DialogTitle>
            <DialogDescription>
              Banners run across the top of the customer home screen.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4 sm:pt-4">
            <FieldGroup>
              <Field data-invalid={errors.imageUrl ? true : undefined}>
                <FieldLabel>Artwork</FieldLabel>

                <input
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  onChange={(event) => pickImage(event.target.files?.[0])}
                  ref={fileInput}
                  type="file"
                />

                {form.imageUrl ? (
                  <div className="flex flex-col gap-2">
                    <img
                      alt=""
                      className="aspect-[3/1] w-full rounded-lg border object-cover"
                      src={form.imageUrl}
                    />
                    <div className="flex gap-2">
                      <Button
                        disabled={uploadImage.isPending}
                        onClick={() => fileInput.current?.click()}
                        size="sm"
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
                  </div>
                ) : (
                  <button
                    className="text-muted-foreground hover:border-primary hover:text-primary flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed transition-colors"
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
                    <span className="text-xs">Wide artwork, roughly 3:1 · Max 5 MB</span>
                  </button>
                )}

                {errors.imageUrl ? <FieldDescription>{errors.imageUrl}</FieldDescription> : null}
              </Field>

              <Field data-invalid={errors.title ? true : undefined}>
                <FieldLabel htmlFor="banner-title">Title</FieldLabel>
                <Input
                  aria-invalid={errors.title ? true : undefined}
                  id="banner-title"
                  onChange={(event) => set("title", event.target.value)}
                  placeholder="Free delivery weekend"
                  value={form.title}
                />
                <FieldDescription>
                  {errors.title ?? "Used in the backoffice and read aloud in the app."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="banner-subtitle">Subtitle</FieldLabel>
                <Input
                  id="banner-subtitle"
                  onChange={(event) => set("subtitle", event.target.value)}
                  placeholder="On orders over $15"
                  value={form.subtitle}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="banner-category">Opens</FieldLabel>
                <Select
                  onValueChange={(value) => set("categorySlug", value)}
                  value={form.categorySlug}
                >
                  <SelectTrigger id="banner-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={NO_CATEGORY}>Nothing — artwork only</SelectItem>
                      {categories?.map((category) => (
                        <SelectItem key={category.slug} value={category.slug}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  The category the home screen filters to when the banner is tapped.
                </FieldDescription>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="banner-starts">Starts</FieldLabel>
                  <Input
                    id="banner-starts"
                    onChange={(event) => set("startsAt", event.target.value)}
                    type="date"
                    value={form.startsAt}
                  />
                </Field>

                <Field data-invalid={errors.endsAt ? true : undefined}>
                  <FieldLabel htmlFor="banner-ends">Ends</FieldLabel>
                  <Input
                    aria-invalid={errors.endsAt ? true : undefined}
                    id="banner-ends"
                    onChange={(event) => set("endsAt", event.target.value)}
                    type="date"
                    value={form.endsAt}
                  />
                  {errors.endsAt ? <FieldDescription>{errors.endsAt}</FieldDescription> : null}
                </Field>
              </div>

              <FieldDescription>
                Leave both empty to run the banner until you switch it off.
              </FieldDescription>

              <Field orientation="horizontal">
                <Switch
                  checked={form.isActive}
                  id="banner-active"
                  onCheckedChange={(value) => set("isActive", value)}
                />
                <FieldLabel htmlFor="banner-active">
                  Live — off keeps it as a draft the app never sees
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
              {banner ? "Save changes" : "Add banner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
