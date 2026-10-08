import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

const asColor = (value: string | number | undefined, fallback: string): string =>
  typeof value === "string" ? value : fallback;

/**
 * The mark every Indian menu uses: a square outline with a filled dot, green
 * for vegetarian. Drawn rather than iconographed because it is a regulated
 * symbol with a specific shape, and a generic leaf icon does not read as it.
 */
export function VegMark({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        alignItems: "center",
        borderColor: color,
        borderRadius: 3,
        borderWidth: 1.5,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: size / 4,
          height: size / 2,
          width: size / 2,
        }}
      />
    </View>
  );
}

type Props = {
  value: boolean;
  onChange: (next: boolean) => void;
};

/** Narrows the kitchens to those serving no meat at all. */
export function VegToggle({ value, onChange }: Props) {
  const [brandVar, surfaceVar, borderVar, mutedVar] = useCSSVariable([
    "--color-brand",
    "--color-surface",
    "--color-border",
    "--color-text-muted",
  ]);

  const brand = asColor(brandVar, "#1fa85c");
  const surface = asColor(surfaceVar, "#ffffff");
  const border = asColor(borderVar, "#e2e8e0");
  const muted = asColor(mutedVar, "#6b7280");

  const progress = useDerivedValue(() => withTiming(value ? 1 : 0, { duration: 180 }), [value]);

  const pill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [surface, brand]),
    borderColor: interpolateColor(progress.value, [0, 1], [border, brand]),
  }));

  const label = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [muted, "#ffffff"]),
  }));

  return (
    <Pressable
      accessibilityLabel="Show only pure vegetarian kitchens"
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={6}
      onPress={() => onChange(!value)}
    >
      <Animated.View
        className="flex-row items-center gap-2 rounded-pill border px-3 py-2"
        style={pill}
      >
        <VegMark color={value ? "#ffffff" : brand} />
        <Animated.Text className="font-title text-sm" style={label}>
          Veg only
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
