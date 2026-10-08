import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

type Props = {
  title: string;
  /** One short line. Left off unless it says something the title cannot. */
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * The heading above a rail or a grid. Exists so every section on every screen
 * shares one set of sizes and one gutter, rather than each screen hand-rolling
 * a Text at whatever size looked right that day.
 */
export function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  const [primary] = useCSSVariable(["--color-primary"]);

  return (
    <View className="flex-row items-end justify-between gap-3 px-gutter pb-3">
      <View className="shrink">
        <Text accessibilityRole="header" className="font-heading text-section text-foreground">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 font-sans text-label text-text-secondary">{subtitle}</Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={`${actionLabel}, ${title}`}
          accessibilityRole="button"
          className="flex-row items-center gap-0.5 active:opacity-60"
          hitSlop={10}
          onPress={onAction}
        >
          <Text className="font-heading text-label text-primary">{actionLabel}</Text>
          <Ionicons color={primary as string} name="chevron-forward" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
