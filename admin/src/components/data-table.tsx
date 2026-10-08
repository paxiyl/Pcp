import {
  createCoreRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type TableFeatures,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDownIcon } from "lucide-react";
import { useState } from "react";

import { DataTablePagination } from "@/components/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** v9 is opt-in per feature: this table sorts and paginates, nothing more. */
const features = tableFeatures({
  coreRowModel: createCoreRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

/** What callers annotate their column arrays with. */
export type DataTableColumns<TData extends RowData> = ColumnDef<TableFeatures, TData>[];

type Props<TData extends RowData> = {
  columns: DataTableColumns<TData>;
  data: TData[];
  /** Rows to draw while loading, so the table holds its height. */
  isLoading?: boolean;
  skeletonRows?: number;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  /** Off by default: short tables (recent orders) do not need controls. */
  paginated?: boolean;
  pageSize?: number;
  /**
   * Server-side paging: the caller owns the page and the totals, and the table
   * just renders the same bar it would draw for a client-paged list.
   */
  pagination?: {
    page: number;
    pages: number;
    total: number;
    /** The server-side page size, which need not match this table's own. */
    pageSize: number;
    onPageChange: (page: number) => void;
    noun?: string;
  };
};

/**
 * One table for the whole backoffice: shadcn Table for the markup, TanStack
 * Table for sorting and pagination. Callers supply columns and rows and get
 * loading and empty states for free.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  isLoading = false,
  skeletonRows = 5,
  emptyMessage = "Nothing to show yet.",
  onRowClick,
  paginated = false,
  pageSize = 10,
  pagination,
}: Props<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useTable({
    features,
    // v9 types columns against a concrete row type; a generic wrapper cannot
    // prove TData satisfies it, so the unsoundness is confined to this line.
    columns: columns as never,
    data,
    // Unpaginated tables show everything; a computed size would be captured
    // on the first render, while data is still empty.
    initialState: { pagination: { pageIndex: 0, pageSize: paginated ? pageSize : 1000 } },
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();

                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        className="flex cursor-pointer items-center gap-1"
                        onClick={() => header.column.toggleSorting()}
                        type="button"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDownIcon className="size-3 opacity-50" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((_column, columnIndex) => (
                  <TableCell key={columnIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                className={cn(onRowClick && "hover:bg-muted/50 cursor-pointer")}
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original as TData) : undefined}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                className="text-muted-foreground h-24 text-center"
                colSpan={columns.length}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pagination ? (
        <DataTablePagination
          noun={pagination.noun}
          onPageChange={pagination.onPageChange}
          page={pagination.page}
          pageSize={pagination.pageSize}
          pages={pagination.pages}
          total={pagination.total}
        />
      ) : paginated && !isLoading && data.length > pageSize ? (
        <DataTablePagination
          onPageChange={(page) => table.setPageIndex(page - 1)}
          page={(table.options.state?.pagination?.pageIndex ?? 0) + 1}
          pageSize={pageSize}
          pages={table.getPageCount()}
          total={data.length}
        />
      ) : null}
    </div>
  );
}
