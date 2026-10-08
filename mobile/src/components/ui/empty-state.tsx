import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { PressableScale } from "./pressable-scale";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  /** What happened, in the customer's words. Not "No data". */
  title: string;
  /** What they can do next. This is the part that makes it not a dead end. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Softer presentation for an empty section inside a populated screen. */
  compact?: boolean;
};

/**
 * Every empty state answers two questions: what happened, and what now.
 *
 * The action is the point. An empty state without one is a dead end, which is
 * why `actionLabel` and `onAction` are offered on every call site that has
 * anywhere to send someone.
 *
 * The icon sits in a soft tinted circle rather than floating loose at 64px — a
 * giant grey glyph reads as an error even when nothing is wrong.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: Props) {
  const [primary] = useCSSVariable(["--color-primary"]);

  return (
    <View className={`items-center justify-center px-gutter ${compact ? "py-8" : "flex-1 py-12"}`}>
      <View
        className="items-center justify-center rounded-pill bg-primary-soft"
        style={{ height: compact ? 52 : 64, width: compact ? 52 : 64 }}
      >
        <Ionicons color={primary as string} name={icon} size={compact ? 24 : 28} />
      </View>

      <Text className="mt-4 text-center font-heading text-section text-foreground">{title}</Text>

      <Text className="mt-1.5 max-w-xs text-center font-sans text-body text-text-secondary">
        {message}
      </Text>

      {actionLabel && onAction ? (
        <PressableScale
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          className="mt-5 h-12 items-center justify-center rounded-input bg-primary px-6"
          onPress={onAction}
        >
          <Text className="font-heading text-body text-primary-foreground">{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
