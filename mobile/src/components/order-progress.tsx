import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { Order, OrderStatus } from "@/lib/api";

type Step = { icon: keyof typeof Ionicons.glyphMap; label: string; status: OrderStatus };

/**
 * The five states an order actually moves through. The design shows a "Nearby"
 * step, but nothing reports proximity yet, so this tracks the real statuses
 * instead of drawing a step that could never light up.
 */
const STEPS: Step[] = [
  { icon: "checkmark", label: "Confirmed", status: "confirmed" },
  { icon: "restaurant", label: "Preparing", status: "preparing" },
  { icon: "bag-check", label: "Ready", status: "ready" },
  { icon: "bicycle", label: "On the way", status: "out_for_delivery" },
  { icon: "home", label: "Delivered", status: "delivered" },
];

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function OrderProgress({ order }: { order: Order }) {
  const [primary, subtle, border] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-border",
  ]);

  // A step is reached if the order ever passed through it, so a jump straight to
  // "out_for_delivery" still shows the earlier steps as done.
  const reachedAt = new Map(
    order.statusHistory.map((entry) => [entry.status, entry.at] as const),
  );
  const currentIndex = STEPS.findIndex((step) => step.status === order.status);

  return (
    <View className="flex-row px-2">
      {STEPS.map((step, index) => {
        const at = reachedAt.get(step.status);
        const done = at !== undefined && index < currentIndex;
        const current = index === currentIndex;
        const reached = done || current;

        return (
          <View className="flex-1 items-center" key={step.status}>
            <View className="h-8 w-full flex-row items-center">
              {/* Rails sit behind the dot so the row stays one continuous line. */}
              <View
                className="h-0.5 flex-1"
                style={{ backgroundColor: index === 0 ? "transparent" : done || current ? (primary as string) : (border as string) }}
              />

              <View
                className="h-8 w-8 items-center justify-center rounded-pill border-2"
                style={{
                  backgroundColor: done ? (primary as string) : "transparent",
                  borderColor: reached ? (primary as string) : (border as string),
                }}
              >
                <Ionicons
                  color={done ? "#ffffff" : reached ? (primary as string) : (subtle as string)}
                  name={done ? "checkmark" : step.icon}
                  size={16}
                />
              </View>

              <View
                className="h-0.5 flex-1"
                style={{
                  backgroundColor:
                    index === STEPS.length - 1
                      ? "transparent"
                      : done
                        ? (primary as string)
                        : (border as string),
                }}
              />
            </View>

            <Text
              className={`mt-2 text-center font-heading text-caption ${
                reached ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step.label}
            </Text>
            <Text className="text-center font-sans text-caption text-muted-foreground">
              {at ? formatTime(at) : " "}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
