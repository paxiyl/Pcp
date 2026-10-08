import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import * as haptics from "@/lib/haptics";
import { DURATION, layoutTransition } from "@/lib/motion";

import { PressableScale } from "./pressable-scale";

type Props = {
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  /** Name of the thing being counted, for the screen reader. */
  label: string;
  size?: "sm" | "md";
  disabled?: boolean;
  /** Blocks the + button once the shelf is exhausted. */
  max?: number;
};

const box = {
  md: "h-10 min-w-24 rounded-chip",
  sm: "h-8 min-w-20 rounded-chip",
} as const;

/**
 * The Add control and the quantity stepper are one component, not two, because
 * they are one object changing state. `layoutTransition` springs the width from
 * the Add pill to the stepper, so the control grows out of itself instead of a
 * button disappearing and a stepper appearing in its place.
 *
 * Both states keep the same height and the same right edge, which is what stops
 * a product grid from reflowing the moment someone adds something.
 */
export function QuantityStepper({
  quantity,
  onAdd,
  onRemove,
  label,
  size = "md",
  disabled = false,
  max,
}: Props) {
  const [primary, foreground] = useCSSVariable(["--color-primary", "--color-primary-foreground"]);
  const iconSize = size === "sm" ? 16 : 18;
  const atMax = max !== undefined && quantity >= max;

  if (quantity === 0) {
    return (
      <PressableScale
        accessibilityHint={`Adds one ${label} to your cart`}
        accessibilityLabel={`Add ${label}`}
        accessibilityRole="button"
        className={`${box[size]} items-center justify-center border border-primary bg-primary-soft px-4 ${
          disabled ? "opacity-50" : ""
        }`}
        disabled={disabled}
        onPress={() => {
          haptics.selection();
          onAdd();
        }}
      >
        <Text className="font-heading text-label uppercase text-primary" style={{ letterSpacing: 0.6 }}>
          {disabled ? "Sold out" : "Add"}
        </Text>
      </PressableScale>
    );
  }

  return (
    <Animated.View
      accessibilityLabel={`${label}, quantity ${quantity}`}
      accessibilityRole="adjustable"
      accessibilityValue={{ now: quantity, text: `${quantity}` }}
      className={`${box[size]} flex-row items-center justify-between bg-primary px-1`}
      layout={layoutTransition}
    >
      <Pressable
        accessibilityLabel={quantity === 1 ? `Remove ${label}` : `Decrease ${label}`}
        accessibilityRole="button"
        // 44pt target on a 40pt control: the padding extends the hit box past the pill.
        hitSlop={{ bottom: 8, left: 10, right: 4, top: 8 }}
        className="h-full w-8 items-center justify-center active:opacity-60"
        onPress={() => {
          haptics.selection();
          onRemove();
        }}
      >
        <Ionicons
          color={foreground as string}
          name={quantity === 1 ? "trash-outline" : "remove"}
          size={iconSize}
        />
      </Pressable>

      {/* The digit is keyed so each value fades in on its own — the number reads
          as changing rather than as a label that silently rewrote itself. */}
      <Animated.Text
        key={quantity}
        className="font-title text-body text-primary-foreground"
        entering={FadeIn.duration(DURATION.state)}
        exiting={FadeOut.duration(DURATION.exit)}
        style={{ fontVariant: ["tabular-nums"] }}
      >
        {quantity}
      </Animated.Text>

      <Pressable
        accessibilityLabel={`Increase ${label}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: atMax }}
        hitSlop={{ bottom: 8, left: 4, right: 10, top: 8 }}
        className={`h-full w-8 items-center justify-center active:opacity-60 ${
          atMax ? "opacity-40" : ""
        }`}
        disabled={atMax}
        onPress={() => {
          haptics.selection();
          onAdd();
        }}
      >
        <Ionicons color={foreground as string} name="add" size={iconSize} />
      </Pressable>
    </Animated.View>
  );
}

/** Exported so a parent can tint an icon to match without re-reading the variable. */
export const useStepperTint = () => useCSSVariable("--color-primary");
