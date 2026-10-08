import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PowerIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminBanner, BannerState } from "@/lib/api";
import { tintedStyle } from "@/lib/order-status";

/** One colour per state, so the badge and any future dot always agree. */
const STATE: Record<BannerState, { label: string; color: string }> = {
  active: { color: "oklch(0.57 0.14 150)", label: "Active" },
  draft: { color: "oklch(0.58 0 0)", label: "Draft" },
  expired: { color: "oklch(0.58 0.20 25)", label: "Expired" },
  scheduled: { color: "oklch(0.66 0.14 80)", label: "Scheduled" },
};

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }) : null;


/** Says what the dates mean, not just what they are: "Runs 1 – 14 Sep". */
const scheduleOf = (banner: AdminBanner) => {
  const from = day(banner.startsAt);
  const to = day(banner.endsAt);
  const started = banner.state !== "scheduled";

  if (from && to) return `${started ? "Runs" : "Starts"} ${from} – ${to}`;
  if (from) return started ? `Since ${from}` : `Starts ${from}`;
  if (to) return `Until ${to}`;

  return "Always on";
};

type RowProps = {
  banner: AdminBanner;
  /** Off while a filter hides rows: the drop position would be meaningless. */
  draggable: boolean;
  onEdit: (banner: AdminBanner) => void;
  onToggleActive: (banner: AdminBanner) => void;
  onDelete: (banner: AdminBanner) => void;
};

function BannerRow({ banner, draggable, onEdit, onToggleActive, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: banner._id,
    disabled: !draggable,
  });

  const state = STATE[banner.state];

  return (
    <TableRow
      className={isDragging ? "bg-muted/60 relative z-10" : undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TableCell className="w-10">
        <button
          aria-label={`Reorder ${banner.title}`}
          className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
          disabled={!draggable}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon className="size-4" />
        </button>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-3">
          {banner.imageUrl ? (
            <img
              alt=""
              className="h-12 w-36 shrink-0 rounded-md border object-cover"
              src={banner.imageUrl}
            />
          ) : (
            <div className="bg-muted text-muted-foreground flex h-12 w-36 shrink-0 items-center justify-center rounded-md">
              <ImageIcon className="size-4" />
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{banner.title}</span>
            {banner.subtitle ? (
              <span className="text-muted-foreground text-xs">{banner.subtitle}</span>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground">
        {banner.categorySlug ? `Home · ${banner.categorySlug}` : "Home"}
      </TableCell>

      <TableCell className="text-muted-foreground">{scheduleOf(banner)}</TableCell>

      <TableCell>
        <Badge
          className="gap-1.5 border-transparent font-medium"
          style={tintedStyle(state.color)}
          variant="secondary"
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: state.color }} />
          {state.label}
        </Badge>
      </TableCell>

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for ${banner.title}`} size="icon" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onEdit(banner)}>
                <PencilIcon data-icon="inline-start" />
                Edit banner
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onToggleActive(banner)}>
                <PowerIcon data-icon="inline-start" />
                {banner.isActive ? "Move to drafts" : "Set live"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(banner)} variant="destructive">
                <Trash2Icon data-icon="inline-start" />
                Delete banner
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

type Props = {
  banners: AdminBanner[];
  isLoading: boolean;
  draggable: boolean;
  emptyMessage: string;
  onEdit: (banner: AdminBanner) => void;
  onToggleActive: (banner: AdminBanner) => void;
  onDelete: (banner: AdminBanner) => void;
  /** The full list in its new order; the page persists it. */
  onReorder: (banners: AdminBanner[]) => void;
};

/**
 * The carousel in the order customers see it, reordered by dragging. Like the
 * categories table, the row order is the data, so there is nothing to sort by.
 */
export function BannerTable({
  banners,
  isLoading,
  draggable,
  emptyMessage,
  onEdit,
  onToggleActive,
  onDelete,
  onReorder,
}: Props) {
  const sensors = useSensors(
    // A few pixels of travel first, so a click on the handle is still a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const from = banners.findIndex((banner) => banner._id === active.id);
    const to = banners.findIndex((banner) => banner._id === over.id);

    if (from === -1 || to === -1) return;

    onReorder(arrayMove(banners, from, to));
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Banner</TableHead>
            <TableHead>Placement</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 6 }).map((_cell, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : banners.length > 0 ? (
            <SortableContext
              items={banners.map((banner) => banner._id)}
              strategy={verticalListSortingStrategy}
            >
              {banners.map((banner) => (
                <BannerRow
                  banner={banner}
                  draggable={draggable}
                  key={banner._id}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                />
              ))}
            </SortableContext>
          ) : (
            <TableRow>
              <TableCell className="text-muted-foreground h-24 text-center" colSpan={6}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DndContext>
  );
}
