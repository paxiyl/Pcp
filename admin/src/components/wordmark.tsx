import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  size?: "sm" | "lg";
  /** "inverse" renders white, for the coloured sign-in panel. */
  tone?: "brand" | "inverse";
};

/**
 * The OnlineMall lockup. Set in type rather than loaded as artwork, so it stays
 * sharp at every size and matches the mobile app's mark exactly.
 */
export function Wordmark({ className, size = "sm", tone = "brand" }: Props) {
  const large = size === "lg";

  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-semibold tracking-tight",
          large ? "text-4xl" : "text-xl",
          tone === "inverse" ? "text-white" : "text-foreground",
        )}
      >
        Online
        <span className={tone === "inverse" ? "text-white" : "text-primary"}>Mall</span>
      </span>

      <span
        className={cn(
          "font-medium uppercase tracking-[0.14em]",
          large ? "text-xs" : "text-[10px]",
          tone === "inverse" ? "text-white/75" : "text-muted-foreground",
        )}
      >
        Hindaun · Operations
      </span>
    </div>
  );
}
