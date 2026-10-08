import type { ReactNode } from "react";
import { Pressable, type PressableProps, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { PRESS_SCALE, PRESS_SPRING } from "@/lib/motion";

type Props = Omit<PressableProps, "style"> & {
  children: ReactNode;
  /** "control" compresses more (buttons, steppers); "card" barely moves. */
  weight?: keyof typeof PRESS_SCALE;
  className?: string;
  style?: ViewStyle;
};

/**
 * Tactile press feedback, driven from a shared value so the compression starts
 * on press-in rather than after React re-renders. Reanimated applies the final
 * value immediately under Reduce Motion, which leaves the control usable with no
 * movement.
 *
 * The Pressable keeps its own hit box: only the inner view scales, so a pressed
 * control's visual never drifts away from the area that actually responds.
 */
export function PressableScale({
  children,
  weight = "control",
  className,
  style,
  disabled,
  ...rest
}: Props) {
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(1 - pressed.value * (1 - PRESS_SCALE[weight]), PRESS_SPRING) },
    ],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      {...rest}
    >
      <Animated.View className={className} style={[style, animated]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
