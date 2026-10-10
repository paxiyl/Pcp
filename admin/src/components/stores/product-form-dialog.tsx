import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ImagePicker } from "@/components/image-picker";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateProduct,
  useProductCategories,
  useUpdateProduct,
} from "@/features/catalogue/use-catalogue";
import type { AdminProduct } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";

type Props = {
  storeId: string;
  /** Absent means "create"; present means "edit that SKU". */
  product?: AdminProduct;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormState = {
  name: string;
  brand: string;
  unit: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  imagePreset: string;
  price: string;
  mrp: string;
  stock: string;
  maxPerOrder: string;
  tags: string;
  isAvailable: boolean;
  isPopular: boolean;
  requiresPrescription: boolean;
};

const EMPTY: FormState = {
  brand: "",
  categoryId: "",
  description: "",
  imageUrl: "",
  imagePreset: "",
  isAvailable: true,
  isPopular: false,
  maxPerOrder: "10",
  mrp: "",
  name: "",
  price: "",
  requiresPrescription: false,
  stock: "0",
  tags: "",
  unit: "",
};

/** Rupees in the form, paise in the database. Converted once, here. */
const toPaise = (rupees: string): number => Math.round(Number(rupees || 0) * 100);
const toRupees = (paise?: number): string =>
  paise === undefined || paise === null ? "" : String(paise / 100);

const categoryIdOf = (product: AdminProduct): string =>
  typeof product.categoryId === "string" ? product.categoryId : product.categoryId._id;

export function ProductFormDialog({ storeId, product, onOpenChange, open }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const categories = useProductCategories();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setForm(
      product
        ? {
            brand: product.brand,
            categoryId: categoryIdOf(product),
            description: product.description,
            imageUrl: product.imageUrl,
            imagePreset: product.imagePreset ?? "",
            isAvailable: product.isAvailable,
            isPopular: product.isPopular,
            maxPerOrder: String(product.maxPerOrder),
            mrp: toRupees(product.mrp),
            name: product.name,
            price: toRupees(product.price),
            requiresPrescription: product.requiresPrescription,
            stock: String(product.stock),
            tags: product.tags.join(", "),
            unit: product.unit,
          }
        : EMPTY,
    );
  }, [open, product]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const price = Number(form.price || 0);
  const mrp = Number(form.mrp || 0);
  // Caught here as well as clamped in the model: the admin should see why the
  // discount they expected is not going to appear, rather than have it silently
  // corrected after saving.
  const mrpBelowPrice = form.mrp !== "" && mrp < price;

  const submit = async () => {
    if (form.name.trim().length < 2) return toast.error("Enter a product name");
    if (!form.unit.trim()) return toast.error("Enter a pack size, such as 1 kg or Medium");
    if (!form.categoryId) return toast.error("Choose a category");
    if (price <= 0) return toast.error("Enter a price");
    if (mrpBelowPrice) return toast.error("MRP cannot be below the selling price");

    const payload = {
      brand: form.brand.trim(),
      categoryId: form.categoryId,
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      imagePreset: form.imagePreset,
      isAvailable: form.isAvailable,
      isPopular: form.isPopular,
      maxPerOrder: Number(form.maxPerOrder || 10),
      // An absent MRP means the product simply is not discounted.
      mrp: form.mrp ? toPaise(form.mrp) : toPaise(form.price),
      name: form.name.trim(),
      price: toPaise(form.price),
      requiresPrescription: form.requiresPrescription,
      stock: Number(form.stock || 0),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      unit: form.unit.trim(),
    };

    try {
      if (product) {
        await update.mutateAsync({ id: product._id, ...payload });
        toast.success("Product updated");
      } else {
        await create.mutateAsync({ storeId, ...payload });
        toast.success("Product added");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(apiMessage(error, "Could not save this product. Try again."));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            One row is one sellable SKU. For sizes or shades, add each as its own product.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="p-name">Name</FieldLabel>
            <Input
              id="p-name"
              onChange={(event) => set("name", event.target.value)}
              placeholder="Aashirvaad Shudh Chakki Atta"
              value={form.name}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-brand">Brand</FieldLabel>
              <Input
                id="p-brand"
                onChange={(event) => set("brand", event.target.value)}
                placeholder="Aashirvaad"
                value={form.brand}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="p-unit">Pack size</FieldLabel>
              <Input
                id="p-unit"
                onChange={(event) => set("unit", event.target.value)}
                placeholder="5 kg, 500 ml, Medium"
                value={form.unit}
              />
              <FieldDescription>Exactly as printed on the pack.</FieldDescription>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="p-category">Category</FieldLabel>
            <Select onValueChange={(value) => set("categoryId", value)} value={form.categoryId}>
              <SelectTrigger id="p-category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(categories.data ?? []).map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.parentId ? `— ${category.name}` : category.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-price">Selling price (₹)</FieldLabel>
              <Input
                id="p-price"
                inputMode="decimal"
                onChange={(event) => set("price", event.target.value)}
                placeholder="299"
                value={form.price}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="p-mrp">Printed MRP (₹)</FieldLabel>
              <Input
                aria-invalid={mrpBelowPrice}
                id="p-mrp"
                inputMode="decimal"
                onChange={(event) => set("mrp", event.target.value)}
                placeholder="Same as price"
                value={form.mrp}
              />
              <FieldDescription className={mrpBelowPrice ? "text-destructive" : undefined}>
                {mrpBelowPrice
                  ? "MRP cannot be below the selling price."
                  : "The discount badge is derived from the gap."}
              </FieldDescription>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="p-stock">Stock</FieldLabel>
              <Input
                id="p-stock"
                inputMode="numeric"
                onChange={(event) => set("stock", event.target.value)}
                value={form.stock}
              />
              <FieldDescription>0 shows the product as sold out.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="p-max">Max per order</FieldLabel>
              <Input
                id="p-max"
                inputMode="numeric"
                onChange={(event) => set("maxPerOrder", event.target.value)}
                value={form.maxPerOrder}
              />
            </Field>
          </div>

          {/* Was a bare "Image URL" text box, which a shopkeeper on a phone has
              no way to fill. Upload or a tile, same as the dish form. */}
          <ImagePicker
            catalogue="grocery"
            folder="products"
            imagePreset={form.imagePreset}
            imageUrl={form.imageUrl}
            label="Product image"
            onChange={(next) =>
              setForm((current) => ({
                ...current,
                imagePreset: next.imagePreset,
                imageUrl: next.imageUrl,
              }))
            }
          />

          <Field>
            <FieldLabel htmlFor="p-desc">Description</FieldLabel>
            <Textarea
              id="p-desc"
              onChange={(event) => set("description", event.target.value)}
              rows={2}
              value={form.description}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="p-tags">Tags</FieldLabel>
            <Input
              id="p-tags"
              onChange={(event) => set("tags", event.target.value)}
              placeholder="Bestseller, Local favourite"
              value={form.tags}
            />
            <FieldDescription>Comma separated. Merchandising only, not status.</FieldDescription>
          </Field>

          <Field orientation="horizontal">
            <div>
              <FieldLabel htmlFor="p-available">Listed</FieldLabel>
              <FieldDescription>Delisted products disappear from the app.</FieldDescription>
            </div>
            <Switch
              checked={form.isAvailable}
              id="p-available"
              onCheckedChange={(value) => set("isAvailable", value)}
            />
          </Field>

          <Field orientation="horizontal">
            <div>
              <FieldLabel htmlFor="p-popular">Popular</FieldLabel>
              <FieldDescription>Surfaces it on home rails.</FieldDescription>
            </div>
            <Switch
              checked={form.isPopular}
              id="p-popular"
              onCheckedChange={(value) => set("isPopular", value)}
            />
          </Field>

          <Field orientation="horizontal">
            <div>
              <FieldLabel htmlFor="p-rx">Prescription only</FieldLabel>
              <FieldDescription>
                The app refuses to add these to a basket. Use for Schedule H medicine.
              </FieldDescription>
            </div>
            <Switch
              checked={form.requiresPrescription}
              id="p-rx"
              onCheckedChange={(value) => set("requiresPrescription", value)}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving || mrpBelowPrice} onClick={() => void submit()}>
            {saving ? <Spinner className="size-4" /> : null}
            {product ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
