import type { ReactNode } from "react";
import { View } from "react-native";
import { type Edge, useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  children: ReactNode;
  /** Safe-area edges this screen owns. Omit an edge a header or navigator already pads. */
  edges?: Edge[];
  className?: string;
};

/**
 * Full-height themed screen root. Applies safe-area padding as real padding so
 * full-bleed media can sit behind it in a sibling layer.
 */
export function Screen({ children, edges = ["top", "bottom"], className = "" }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`flex-1 bg-background ${className}`}
      style={{
        paddingTop: edges.includes("top") ? insets.top : 0,
        paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
        paddingLeft: edges.includes("left") ? insets.left : 0,
        paddingRight: edges.includes("right") ? insets.right : 0,
      }}
    >
      {children}
    </View>
  );
}
