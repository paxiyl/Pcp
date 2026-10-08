import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** 1-based, like the API. */
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Singular noun for the range line: "order" becomes "orders". */
  noun?: string;
};

/**
 * First page, last page and a window around the current one, with ellipses for
 * whatever it skips: 1 … 6 7 8 … 14. Short lists just list every page.
 */
const pageItems = (page: number, pages: number): (number | "gap")[] => {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);

  const window = [page - 1, page, page + 1].filter((value) => value > 1 && value < pages);
  const items: (number | "gap")[] = [1];

  if (window[0] !== undefined && window[0] > 2) items.push("gap");
  items.push(...window);
  if (window[window.length - 1] !== undefined && window[window.length - 1] < pages - 1) {
    items.push("gap");
  }
  items.push(pages);

  return items;
};

/** The one pagination bar for the backoffice: a range line and numbered pages. */
export function DataTablePagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  noun = "result",
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm">
        Showing {from}–{to} of {total} {total === 1 ? noun : `${noun}s`}
      </p>

      <nav aria-label="Pagination" className="flex items-center gap-1">
        <Button
          className="mr-1"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          size="sm"
          variant="ghost"
        >
          Previous
        </Button>

        {pageItems(page, pages).map((item, index) =>
          item === "gap" ? (
            <span
              aria-hidden
              className="text-muted-foreground flex size-8 items-end justify-center"
              key={`gap-${index}`}
            >
              …
            </span>
          ) : (
            <Button
              aria-current={item === page ? "page" : undefined}
              className={cn("size-8", item === page && "pointer-events-none")}
              key={item}
              onClick={() => onPageChange(item)}
              size="icon"
              variant={item === page ? "default" : "ghost"}
            >
              {item}
            </Button>
          ),
        )}

        <Button
          className="ml-1"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          size="sm"
          variant="ghost"
        >
          Next
        </Button>
      </nav>
    </div>
  );
}
