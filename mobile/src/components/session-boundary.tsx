import { Image } from "expo-image";
import { ActivityIndicator, View } from "react-native";

const mark = require("../../assets/images/logo-mark-white.png");

/**
 * Shown while the stored token and /auth/me decide which screen comes first.
 * The redirect itself lives in `useProtectedRoute`, mounted by the root layout.
 *
 * Deliberately identical to the splash screen — same teal, same mark, same
 * size — so the handover from the native splash is invisible.
 */
const SPLASH_BACKGROUND = "#00BFA5";
const MARK_WIDTH = 144;

export function SessionLoading() {
  return (
    <View
      className="flex-1 items-center justify-center gap-3"
      style={{ backgroundColor: SPLASH_BACKGROUND }}
    >
      {/* expo-image ignores className for sizing, so the box is a style. */}
      <Image
        contentFit="contain"
        source={mark}
        style={{ height: MARK_WIDTH, width: MARK_WIDTH }}
      />
      <ActivityIndicator color="white" size="large" />
    </View>
  );
}
