import type { AdminOrderStatusEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/order-status";

/** The trail the order already carries; newest first, like the mobile app. */
export function OrderTimeline({ history }: { history: AdminOrderStatusEntry[] }) {
  const entries = [...history].reverse();

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const { date, time } = formatDateTime(entry.at);
        const color = ORDER_STATUS[entry.status].color;
        const isLatest = index === 0;

        return (
          <li className="flex gap-3" key={entry._id}>
            <div className="flex flex-col items-center">
              <span
                className="mt-1 size-3 shrink-0 rounded-full ring-4"
                style={{
                  backgroundColor: isLatest ? color : "transparent",
                  border: `2px solid ${color}`,
                  // A soft halo instead of a hard ring against the card.
                  boxShadow: `0 0 0 3px color-mix(in oklch, ${color} 12%, transparent)`,
                }}
              />
              {index < entries.length - 1 ? <span className="bg-border w-px flex-1" /> : null}
            </div>

            <div className="flex flex-1 flex-col pb-6">
              <span className="text-sm font-medium">{ORDER_STATUS[entry.status].label}</span>
              {entry.note ? (
                <span className="text-muted-foreground text-sm">{entry.note}</span>
              ) : null}
              <span className="text-muted-foreground text-xs">
                {date} · {time}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
