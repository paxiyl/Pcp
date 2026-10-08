import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Easing, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

/** Groceries and daily essentials, or cooked food from restaurants. */
export type DeliveryMode = "grocery" | "food";

const MODE_KEY = "onlinemall.mode";

/**
 * One easing for every part of the switch.
 *
 * Shared deliberately: the pill, the header wash and the content dissolve all
 * run off the same curve and duration, so the whole screen reads as one
 * movement rather than three things that happen to change at once.
 */
export const MODE_TIMING = {
  duration: 340,
  easing: Easing.bezier(0.22, 1, 0.36, 1),
} as const;

type DeliveryModeValue = {
  mode: DeliveryMode;
  setMode: (next: DeliveryMode) => void;
  toggle: () => void;
  /**
   * 0 is grocery, 1 is food. Every colour and position that animates reads
   * this, so a drag can scrub the whole screen mid-gesture instead of only
   * animating once the finger lifts.
   */
  progress: SharedValue<number>;
};

const DeliveryModeContext = createContext<DeliveryModeValue | null>(null);

export function DeliveryModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DeliveryMode>("grocery");
  const progress = useSharedValue(0);

  // Reopen where they left off. A customer who shops food every evening should
  // not have to switch every time.
  useEffect(() => {
    let cancelled = false;

    void SecureStore.getItemAsync(MODE_KEY)
      .then((stored) => {
        if (cancelled || stored !== "food") return;

        setModeState("food");
        // No animation on restore: this is the screen's starting state, not a
        // change the customer just made.
        progress.value = 1;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [progress]);

  const setMode = useCallback(
    (next: DeliveryMode) => {
      setModeState((current) => {
        if (current === next) return current;

        progress.value = withTiming(next === "food" ? 1 : 0, MODE_TIMING);
        void SecureStore.setItemAsync(MODE_KEY, next).catch(() => undefined);

        return next;
      });
    },
    [progress],
  );

  const toggle = useCallback(() => {
    setMode(mode === "food" ? "grocery" : "food");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, progress, setMode, toggle }),
    [mode, progress, setMode, toggle],
  );

  return <DeliveryModeContext.Provider value={value}>{children}</DeliveryModeContext.Provider>;
}

export const useDeliveryMode = (): DeliveryModeValue => {
  const value = useContext(DeliveryModeContext);

  if (!value) throw new Error("useDeliveryMode must be used inside DeliveryModeProvider");

  return value;
};
