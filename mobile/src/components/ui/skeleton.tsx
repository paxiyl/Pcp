import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type Props = {
  className?: string;
  style?: ViewStyle;
};

/**
 * One skeleton block. Everything else composes from this, so the pulse timing is
 * identical across every loading screen rather than each one inventing its own.
 *
 * The pulse is opacity only — no translating highlight sweep. A sweep draws the
 * eye to the animation; this draws it to the shape, which is the thing that is
 * supposed to tell you what is about to arrive.
 *
 * Under Reduce Motion the block holds at its mid opacity. Still visibly a
 * placeholder, just not moving.
 */
export function Skeleton({ className = "", style }: Props) {
  const progress = useSharedValue(0.6);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    progress.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: progress.value }));

  return <Animated.View className={`bg-muted ${className}`} style={[style, animated]} />;
}

/** A line of text. Width is a percentage so it reflows with its container. */
export function SkeletonLine({
  width = "100%",
  height = 12,
  className = "",
}: {
  width?: number | `${number}%`;
  height?: number;
  className?: string;
}) {
  return <Skeleton className={`rounded-input ${className}`} style={{ height, width }} />;
}

/** Spacer that keeps a skeleton aligned with the real layout's gutters. */
export function SkeletonRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-rail px-gutter">{children}</View>;
}
