import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
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
import type { AdminDishOptionGroup } from "@/lib/api";
import { Switch } from "../ui/switch";

/**
 * The editor works in whole currency and needs a stable React key per row, so
 * it keeps its own shape rather than editing the API payload in place.
 */
export type EditableOption = {
  key: string;
  /** Present only for a choice that already exists; kept so its id survives. */
  _id?: string;
  name: string;
  price: string;
  isDefault: boolean;
};

export type EditableGroup = {
  key: string;
  _id?: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: EditableOption[];
};

let sequence = 0;
const nextKey = () => `row-${(sequence += 1)}`;

const toMajor = (cents: number) => (cents / 100).toFixed(2);
const toMinor = (value: string) => Math.round(Number(value || 0) * 100);

export const toEditableGroups = (groups: AdminDishOptionGroup[]): EditableGroup[] =>
  groups.map((group) => ({
    _id: group._id,
    key: nextKey(),
    name: group.name,
    options: group.options.map((option) => ({
      _id: option._id,
      isDefault: Boolean(option.isDefault),
      key: nextKey(),
      name: option.name,
      price: toMajor(option.priceDelta),
    })),
    required: group.required,
    type: group.type,
  }));

export const toApiGroups = (groups: EditableGroup[]): AdminDishOptionGroup[] =>
  groups.map((group) => ({
    ...(group._id ? { _id: group._id } : {}),
    name: group.name.trim(),
    options: group.options.map((option) => ({
      ...(option._id ? { _id: option._id } : {}),
      isDefault: option.isDefault,
      name: option.name.trim(),
      priceDelta: toMinor(option.price),
    })),
    required: group.required,
    type: group.type,
  }));

/** Rejects the shapes the app cannot render; returns null when the set is fine. */
export const validateGroups = (groups: EditableGroup[]): string | null => {
  if (groups.some((group) => !group.name.trim())) return "Every option group needs a name";
  if (groups.some((group) => group.options.length === 0)) {
    return "Every option group needs at least one choice";
  }
  if (groups.some((group) => group.options.some((option) => !option.name.trim()))) {
    return "Every choice needs a name";
  }

  return null;
};

const emptyOption = (): EditableOption => ({
  isDefault: false,
  key: nextKey(),
  name: "",
  price: "0.00",
});

const emptyGroup = (): EditableGroup => ({
  key: nextKey(),
  name: "",
  options: [emptyOption()],
  required: false,
  type: "single",
});

type Props = {
  value: EditableGroup[];
  onChange: (groups: EditableGroup[]) => void;
};

export function DishOptionGroups({ value, onChange }: Props) {
  const patchGroup = (key: string, patch: Partial<EditableGroup>) =>
    onChange(value.map((group) => (group.key === key ? { ...group, ...patch } : group)));

  const patchOption = (groupKey: string, optionKey: string, patch: Partial<EditableOption>) =>
    onChange(
      value.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              options: group.options.map((option) =>
                option.key === optionKey ? { ...option, ...patch } : option,
              ),
            }
          : group,
      ),
    );

  /** A single-choice group can only have one default, like the radios it renders. */
  const setDefault = (group: EditableGroup, optionKey: string, isDefault: boolean) => {
    if (group.type === "multiple") {
      patchOption(group.key, optionKey, { isDefault });

      return;
    }

    patchGroup(group.key, {
      options: group.options.map((option) => ({
        ...option,
        isDefault: option.key === optionKey ? isDefault : false,
      })),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>Options and extras</FieldLabel>
          <FieldDescription>
            Sizes, add-ons and removals, shown on the dish page in the app.
          </FieldDescription>
        </div>

        <Button onClick={() => onChange([...value, emptyGroup()])} size="sm" type="button" variant="outline">
          <PlusIcon data-icon="inline-start" />
          Add group
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          No options yet. Add a group such as “Choose size” or “Add extras”.
        </p>
      ) : null}

      {value.map((group) => (
        <div className="flex flex-col gap-4 rounded-lg border p-4 px-2" key={group.key}>
          <div className="flex flex-wrap items-center gap-2">
            <GripVerticalIcon className="text-muted-foreground size-4 shrink-0" />

            <Input
              aria-label="Group name"
              className="min-w-40 flex-1"
              onChange={(event) => patchGroup(group.key, { name: event.target.value })}
              placeholder="Choose size"
              value={group.name}
            />

            <Select
              onValueChange={(type) =>
                patchGroup(group.key, { type: type as EditableGroup["type"] })
              }
              value={group.type}
            >
              <SelectTrigger aria-label="Choice type" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="single">Pick one</SelectItem>
                  <SelectItem value="multiple">Pick many</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              aria-label={`Remove ${group.name || "group"}`}
              onClick={() => onChange(value.filter((item) => item.key !== group.key))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2Icon />
            </Button>
          </div>

          <div className="flex items-center gap-2 pl-6">
            <Switch
              checked={group.required}
              id={`${group.key}-required`}
              onCheckedChange={(required) => patchGroup(group.key, { required })}
            />
            <FieldLabel className="font-sm" htmlFor={`${group.key}-required`}>
              Required customer must choose before adding to the basket
            </FieldLabel>
          </div>

          <div className="flex flex-col gap-2 pl-5">
            {group.options.map((option) => (
              <div className="flex flex-wrap items-center gap-1" key={option.key}>
                <Input
                  aria-label="Choice name"
                  className="min-w-[155px] flex-1"
                  onChange={(event) =>
                    patchOption(group.key, option.key, { name: event.target.value })
                  }
                  placeholder="Regular (10”)"
                  value={option.name}
                />

                <InputGroup className="w-28">
                  <InputGroupAddon>+$</InputGroupAddon>
                  <InputGroupInput
                    aria-label="Extra cost"
                    min={0}
                    onChange={(event) =>
                      patchOption(group.key, option.key, { price: event.target.value })
                    }
                    step="0.01"
                    type="number"
                    value={option.price}
                  />
                </InputGroup>

                <label className="flex w-24 items-center gap-2 text-sm">
                  <Checkbox
                    checked={option.isDefault}
                    onCheckedChange={(checked) => setDefault(group, option.key, checked === true)}
                  />
                  Default
                </label>

                <Button
                  aria-label={`Remove ${option.name || "choice"}`}
                  onClick={() =>
                    patchGroup(group.key, {
                      options: group.options.filter((item) => item.key !== option.key),
                    })
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}

            <Button
              className="w-fit"
              onClick={() =>
                patchGroup(group.key, { options: [...group.options, emptyOption()] })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <PlusIcon data-icon="inline-start" />
              Add choice
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
