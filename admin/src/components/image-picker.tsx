import { ImageIcon, UploadIcon } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useImagePresets } from "@/features/presets/use-image-presets";
import { useUploadImage } from "@/features/uploads/use-upload-image";
import type { ImagePreset, PresetCatalogue } from "@/lib/api";
import { ApiError } from "@/lib/axios-client";

type Props = {
  label: string;
  /** A hosted photograph, when one has been uploaded. */
  imageUrl: string;
  /** A preset tile key, used instead of a photograph. */
  imagePreset: string;
  /** Which half of the catalogue to offer presets from. */
  catalogue: PresetCatalogue;
  /** The Cloudinary folder an upload lands in. */
  folder: string;
  onChange: (next: { imageUrl: string; imagePreset: string }) => void;
};

/** The tile as the app draws it, so the choice here matches what customers see. */
export function PresetTile({
  className = "",
  preset,
  size = 28,
}: {
  className?: string;
  preset: ImagePreset;
  size?: number;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
        fontSize: size,
        lineHeight: 1,
      }}
    >
      <span aria-hidden>{preset.glyph}</span>
    </div>
  );
}

/**
 * Picking a picture for a catalogue item.
 *
 * Two routes, because a shopkeeper adding forty products in an evening will not
 * photograph forty products: upload a real photo, or choose a tile. The tile is
 * not a placeholder we impose — the owner picks which one, so a bag of atta
 * looks like groceries and a pizza looks like a pizza, and the shelf reads as
 * deliberate rather than as a wall of empty grey squares.
 *
 * A photograph always wins when both are set, so choosing a tile now and
 * photographing the item later needs no cleanup.
 *
 * When this deployment has no image hosting configured, Upload is not offered
 * at all rather than offered and then refused: the owner finds that out before
 * they pick a file, not after.
 */
export function ImagePicker({
  label,
  imageUrl,
  imagePreset,
  catalogue,
  folder,
  onChange,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();
  const { data } = useImagePresets();

  const presets = (data?.presets ?? []).filter((preset) => preset.catalogue === catalogue);
  const selected = presets.find((preset) => preset.key === imagePreset);
  const uploadsEnabled = data?.uploadsEnabled ?? false;

  const pickFile = (file?: File) => {
    if (!file) return;

    uploadImage.mutate(
      { file, folder },
      {
        onError: (error) =>
          toast.error("Upload failed", {
            description: error instanceof ApiError ? error.message : "Please try again.",
          }),
        // The preset is kept, not cleared: it is what the item falls back to if
        // the photo is ever removed.
        onSuccess: (response) => onChange({ imagePreset, imageUrl: response.data.url }),
      },
    );
  };

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>

      <input
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={(event) => pickFile(event.target.files?.[0])}
        ref={fileInput}
        type="file"
      />

      <div className="flex items-start gap-4">
        {/* What the customer will actually see, in the same order the app
            resolves it: photo, then tile, then nothing. */}
        {imageUrl ? (
          <img alt="" className="size-28 shrink-0 rounded-lg border object-cover" src={imageUrl} />
        ) : selected ? (
          <PresetTile className="size-28 shrink-0 rounded-lg border" preset={selected} size={44} />
        ) : (
          <div className="text-muted-foreground flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed">
            <ImageIcon className="size-5" />
            <span className="text-xs">No image</span>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          {uploadsEnabled ? (
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
              {imageUrl ? "Replace photo" : "Upload a photo"}
            </Button>
          ) : (
            <FieldDescription>
              Photo uploads are off — no image hosting is configured on this server. Pick a tile
              below instead.
            </FieldDescription>
          )}

          {imageUrl ? (
            <Button
              onClick={() => onChange({ imagePreset, imageUrl: "" })}
              size="sm"
              type="button"
              variant="ghost"
            >
              Remove photo
            </Button>
          ) : null}

          <FieldDescription>
            {imageUrl
              ? selected
                ? `The photo is shown. "${selected.label}" is kept as a fallback.`
                : "The photo is shown to customers."
              : selected
                ? `Customers see the "${selected.label}" tile.`
                : "Pick a tile so this item is not a blank square on the shelf."}
          </FieldDescription>
        </div>
      </div>

      <div className="mt-1">
        <FieldDescription className="mb-2">
          {uploadsEnabled ? "Or pick a tile" : "Pick a tile"}
        </FieldDescription>

        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = preset.key === imagePreset;

            return (
              <button
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-sm transition-colors ${
                  active
                    ? "border-primary ring-primary/30 ring-2"
                    : "hover:border-primary border-input"
                }`}
                key={preset.key}
                onClick={() =>
                  // Pressing the chosen tile again clears it, so there is a way
                  // back to no image without a separate Remove control.
                  onChange({ imagePreset: active ? "" : preset.key, imageUrl })
                }
                title={preset.label}
                type="button"
              >
                <PresetTile className="size-8 rounded-md" preset={preset} size={18} />
                <span className="whitespace-nowrap">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Field>
  );
}
