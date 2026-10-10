import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { useDeliveryMode } from "@/features/mode/delivery-mode";

/** uniwind can hand back a number or nothing; the interpolators need a string. */
const asColor = (value: string | number | undefined, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const PADDING = 4;

/**
 * The switch between shopping and ordering food.
 *
 * Draggable as well as tappable, because the two halves of this app are peers
 * and a switch you can throw with a thumb says that more plainly than a tab
 * would. The thumb follows the finger rather than waiting for release, so the
 * header colour and the content underneath scrub with the gesture — the screen
 * answers while you are still deciding, which is what makes it feel direct
 * rather than like a page load.
 */
export function ModeSwitch() {
  const { mode, progress, scrub, setMode } = useDeliveryMode();
  const [trackWidth, setTrackWidth] = useState(0);

  const [brandVar, foodVar, surfaceVar, mutedVar] = useCSSVariable([
    "--color-brand",
    "--color-food",
    "--color-surface",
    "--color-text-muted",
  ]);

  const brand = asColor(brandVar, "#1fa85c");
  const food = asColor(foodVar, "#d9480f");
  const surface = asColor(surfaceVar, "#ffffff");
  const muted = asColor(mutedVar, "#6b7280");

  const half = Math.max(0, (trackWidth - PADDING * 2) / 2);

  const thumb = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [brand, food]),
    transform: [{ translateX: progress.value * half }],
    width: half,
  }));

  // Each label brightens as its own side takes over, so the switch reads at a
  // glance without needing a separate indicator.
  const groceryLabel = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], ["#ffffff", muted]),
  }));

  const foodLabel = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [muted, "#ffffff"]),
  }));

  // A short drag should still commit: past a third of the way is a decision,
  // not a wobble.
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((event) => {
      if (half <= 0) return;

      const start = mode === "food" ? 1 : 0;

      scrub(start + event.translationX / half);
    })
    .onEnd((event) => {
      if (half <= 0) return;

      const start = mode === "food" ? 1 : 0;
      const landed = start + event.translationX / half;
      // Velocity counts, so a quick flick commits even if it travelled little.
      const next = landed + event.velocityX / half / 8 > 0.5 ? "food" : "grocery";

      // setMode animates the thumb home as well as recording the choice, so a
      // drag that ends where it started is still tidied up.
      runOnJS(setMode)(next);
    });

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="tablist"
        className="rounded-pill"
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={{ backgroundColor: surface, padding: PADDING }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              borderRadius: 999,
              bottom: PADDING,
              left: PADDING,
              position: "absolute",
              top: PADDING,
            },
            thumb,
          ]}
        />

        <View className="flex-row">
          <Pressable
            accessibilityLabel="Shop groceries"
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "grocery" }}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
            onPress={() => setMode("grocery")}
          >
            <Animated.Text style={groceryLabel}>
              <Ionicons name="basket-outline" size={15} />
            </Animated.Text>
            <Animated.Text className="font-title text-sm" style={groceryLabel}>
              Groceries
            </Animated.Text>
          </Pressable>

          <Pressable
            accessibilityLabel="Order food"
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "food" }}
            className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
            onPress={() => setMode("food")}
          >
            <Animated.Text style={foodLabel}>
              <Ionicons name="restaurant-outline" size={15} />
            </Animated.Text>
            <Animated.Text className="font-title text-sm" style={foodLabel}>
              Food
            </Animated.Text>
          </Pressable>
        </View>
      </View>
    </GestureDetector>
  );
}
