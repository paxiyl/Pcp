import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { PressableScale } from "./pressable-scale";

type Props = {
  /** Plain language, no error codes. Falls back to something safe. */
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
};

/**
 * The failure state for a screen that could not load.
 *
 * Deliberately does NOT accept an error object. Passing one invites
 * `error.message` into the UI, and that is how a customer ends up reading
 * "E11000 duplicate key" or a Mongoose cast error. The caller logs the real
 * error; the customer gets a sentence and a button.
 *
 * Styled as informational rather than destructive. A failed fetch is usually a
 * dropped mobile connection — red is for things the customer did, not for a
 * train going through a tunnel.
 */
export function ErrorState({
  title = "We could not load this",
  message = "Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  compact = false,
}: Props) {
  const [warning] = useCSSVariable(["--color-warning"]);

  return (
    <View className={`items-center justify-center px-gutter ${compact ? "py-8" : "flex-1 py-12"}`}>
      <View
        className="items-center justify-center rounded-pill bg-warning-soft"
        style={{ height: compact ? 52 : 64, width: compact ? 52 : 64 }}
      >
        <Ionicons color={warning as string} name="cloud-offline-outline" size={compact ? 24 : 28} />
      </View>

      <Text className="mt-4 text-center font-heading text-section text-foreground">{title}</Text>

      <Text className="mt-1.5 max-w-xs text-center font-sans text-body text-text-secondary">
        {message}
      </Text>

      {onRetry ? (
        <PressableScale
          accessibilityLabel={retryLabel}
          accessibilityRole="button"
          className="mt-5 h-12 items-center justify-center rounded-input border border-border bg-surface px-6"
          onPress={onRetry}
        >
          <Text className="font-heading text-body text-foreground">{retryLabel}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
