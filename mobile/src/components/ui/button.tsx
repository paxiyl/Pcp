import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

type Variant = "primary" | "outline" | "outline-inverse" | "link";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
};

const container: Record<Variant, string> = {
  primary: "h-13 rounded-input bg-primary active:bg-primary-pressed",
  outline: "h-13 rounded-input border border-border bg-card active:bg-muted",
  "outline-inverse": "h-13 rounded-input border border-white/70 active:bg-white/15",
  link: "h-11 rounded-input active:opacity-70",
};

const labelStyle: Record<Variant, string> = {
  primary: "font-heading text-body text-primary-foreground",
  outline: "font-heading text-body text-card-foreground",
  "outline-inverse": "font-heading text-body text-white",
  link: "font-heading text-body text-primary",
};

/** The two inverse variants sit on colour, so their white is not theme-bound. */
const SPINNER_VARIABLE: Record<Variant, string | null> = {
  primary: null,
  outline: "--color-card-foreground",
  "outline-inverse": null,
  link: "--color-primary",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
}: Props) {
  // The variable is read every render, so the spinner follows the theme.
  const themed = useCSSVariable(SPINNER_VARIABLE[variant] ?? "--color-card-foreground");
  const spinner = SPINNER_VARIABLE[variant] ? (themed as string) : "#ffffff";

  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      className={`flex-row items-center justify-center gap-2 self-stretch px-5 ${container[variant]} ${
        inactive ? "opacity-60" : ""
      }`}
      disabled={inactive}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={spinner} size="small" />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text className={labelStyle[variant]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
