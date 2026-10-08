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
import { GripVerticalIcon, ImageIcon, MoreHorizontalIcon, PencilIcon, PowerIcon } from "lucide-react";

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
import type { AdminCategory } from "@/lib/api";
import { tintedStyle } from "@/lib/order-status";

const ACTIVE_COLOR = "oklch(0.57 0.14 150)";
const INACTIVE_COLOR = "oklch(0.58 0 0)";

type RowProps = {
  category: AdminCategory;
  /** Off while a filter hides rows: the drop position would be meaningless. */
  draggable: boolean;
  onEdit: (category: AdminCategory) => void;
  onToggleActive: (category: AdminCategory) => void;
};

function CategoryRow({ category, draggable, onEdit, onToggleActive }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category._id,
    disabled: !draggable,
  });

  return (
    <TableRow
      className={isDragging ? "bg-muted/60 relative z-10" : undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TableCell className="w-10">
        <button
          aria-label={`Reorder ${category.name}`}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed"
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
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: category.backgroundColor }}
          >
            {category.imageUrl ? (
              <img alt="" className="size-7 object-contain" src={category.imageUrl} />
            ) : (
              <ImageIcon className="text-muted-foreground size-4" />
            )}
          </div>
          <span className="font-medium">{category.name}</span>
        </div>
      </TableCell>

      <TableCell className="text-muted-foreground">{category.slug}</TableCell>
      <TableCell>{category.restaurantCount}</TableCell>
      <TableCell>{category.dishCount}</TableCell>

      <TableCell>
        <Badge
          className="gap-1.5 border-transparent font-medium"
          style={tintedStyle(category.isActive ? ACTIVE_COLOR : INACTIVE_COLOR)}
          variant="secondary"
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: category.isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}
          />
          {category.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>

      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Actions for ${category.name}`} size="icon" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => onEdit(category)}>
                <PencilIcon data-icon="inline-start" />
                Edit category
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onToggleActive(category)}
                variant={category.isActive ? "destructive" : undefined}
              >
                <PowerIcon data-icon="inline-start" />
                {category.isActive ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

type Props = {
  categories: AdminCategory[];
  isLoading: boolean;
  draggable: boolean;
  emptyMessage: string;
  onEdit: (category: AdminCategory) => void;
  onToggleActive: (category: AdminCategory) => void;
  /** The full list in its new order; the page persists it. */
  onReorder: (categories: AdminCategory[]) => void;
};

/**
 * The catalogue in display order, reordered by dragging. It has its own table
 * rather than the shared DataTable because the row order *is* the data here:
 * there is nothing to sort by and nothing to paginate.
 */
export function CategoryTable({
  categories,
  isLoading,
  draggable,
  emptyMessage,
  onEdit,
  onToggleActive,
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

    const from = categories.findIndex((category) => category._id === active.id);
    const to = categories.findIndex((category) => category._id === over.id);

    if (from === -1 || to === -1) return;

    onReorder(arrayMove(categories, from, to));
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
            <TableHead>Category</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Restaurants</TableHead>
            <TableHead>Dishes</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 7 }).map((_cell, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : categories.length > 0 ? (
            <SortableContext
              items={categories.map((category) => category._id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((category) => (
                <CategoryRow
                  category={category}
                  draggable={draggable}
                  key={category._id}
                  onEdit={onEdit}
                  onToggleActive={onToggleActive}
                />
              ))}
            </SortableContext>
          ) : (
            <TableRow>
              <TableCell className="text-muted-foreground h-24 text-center" colSpan={7}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </DndContext>
  );
}
