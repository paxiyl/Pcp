import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { type ColorValue, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useBasket } from "@/features/basket/use-basket";
import { SPRING } from "@/lib/motion";

type Props = {
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
  // What the navigator hands the tabBarIcon callback, and what Ionicons takes:
  // a plain string or a platform colour object. Narrowing it to string here
  // just made every call site an error.
  color: ColorValue;
  focused: boolean;
  /** Draws the basket count over the icon. Only the basket tab sets this. */
  showBasketCount?: boolean;
};

/**
 * A tab icon that reacts to selection.
 *
 * The movement is 2pt of lift and a 1.08 scale — enough to confirm the tap on a
 * surface the thumb is already covering, small enough that four of them
 * switching does not make the bar feel unstable. Colour and the filled/outline
 * pair do the actual work of saying which tab is active; the motion only
 * acknowledges the press.
 */
export function TabBarIcon({ name, activeName, color, focused, showBasketCount }: Props) {
  const progress = useSharedValue(focused ? 1 : 0);
  const { data } = useBasket();
  const count = data?.totals.itemCount ?? 0;

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING.snappy);
  }, [focused, progress]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.08 }, { translateY: progress.value * -2 }],
  }));

  return (
    <Animated.View style={animated}>
      <Ionicons color={color} name={focused ? activeName : name} size={23} />

      {showBasketCount && count > 0 ? (
        <View
          accessibilityLabel={`${count} items in basket`}
          className="absolute -right-2.5 -top-1 h-4 min-w-4 items-center justify-center rounded-pill bg-offer px-1"
        >
          <Text
            className="font-title text-micro text-offer-foreground"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {count > 9 ? "9+" : count}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
