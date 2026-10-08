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
import {
  useCreateProductCategory,
  useUpdateProductCategory,
} from "@/features/catalogue/use-store-owners";
import type { AdminProductCategory } from "@/lib/api";
import { apiMessage } from "@/lib/axios-client";

type Props = {
  category?: AdminProductCategory;
  /** Set when adding a sub-category under a specific department. */
  parentId: string | null;
  parents: AdminProductCategory[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/** The storefront tints each category tile, so the palette lives with the data. */
const TINTS = ["#E8F6EC", "#FDF2E3", "#EAF0FE", "#FDEEE7", "#F1EBFD", "#E7F6EC"];

export function ProductCategoryFormDialog({
  category,
  parentId,
  parents,
  onOpenChange,
  open,
}: Props) {
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [backgroundColor, setBackgroundColor] = useState(TINTS[0]);
  const [isActive, setIsActive] = useState(true);

  const create = useCreateProductCategory();
  const update = useUpdateProductCategory();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;

    setName(category?.name ?? "");
    setImageUrl(category?.imageUrl ?? "");
    setBackgroundColor(category?.backgroundColor ?? TINTS[0]);
    setIsActive(category?.isActive ?? true);
  }, [open, category]);

  const parentName = parents.find((parent) => parent._id === parentId)?.name;

  const submit = async () => {
    if (name.trim().length < 2) return toast.error("Enter a category name");

    const payload = {
      backgroundColor,
      imageUrl: imageUrl.trim(),
      isActive,
      name: name.trim(),
    };

    try {
      if (category) {
        await update.mutateAsync({ id: category._id, ...payload });
        toast.success("Category updated");
      } else {
        await create.mutateAsync({ ...payload, parentId });
        toast.success("Category added");
      }

      onOpenChange(false);
    } catch (error) {
      toast.error(apiMessage(error, "Could not save this category."));
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit category" : parentName ? `Add under ${parentName}` : "Add department"}
          </DialogTitle>
          <DialogDescription>
            Categories nest one level only — deeper has no navigation to reach it.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
            <Input
              id="cat-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Staples"
              value={name}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="cat-image">Image URL</FieldLabel>
            <Input
              id="cat-image"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://…"
              value={imageUrl}
            />
            <FieldDescription>
              Optional. Without one the tile shows the first letter on the tint.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Tile tint</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TINTS.map((tint) => (
                <button
                  aria-label={`Tint ${tint}`}
                  aria-pressed={backgroundColor === tint}
                  className={`size-9 rounded-lg border-2 ${
                    backgroundColor === tint ? "border-primary" : "border-border"
                  }`}
                  key={tint}
                  onClick={() => setBackgroundColor(tint)}
                  style={{ backgroundColor: tint }}
                  type="button"
                />
              ))}
            </div>
          </Field>

          <Field orientation="horizontal">
            <div>
              <FieldLabel htmlFor="cat-active">Listed</FieldLabel>
              <FieldDescription>Hidden categories disappear from the app.</FieldDescription>
            </div>
            <Switch checked={isActive} id="cat-active" onCheckedChange={setIsActive} />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {saving ? <Spinner className="size-4" /> : null}
            {category ? "Save changes" : "Add category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
