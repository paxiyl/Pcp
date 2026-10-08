import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { declinePush, enablePush } from "@/features/settings/notifications";
import { DURATION } from "@/lib/motion";

import { PressableScale } from "./ui/pressable-scale";

type Props = {
  open: boolean;
  onClose: () => void;
};

const REASONS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "bicycle-outline", text: "When your rider sets off, and when they are at your door" },
  { icon: "pricetag-outline", text: "Price drops on things you have bought before" },
  { icon: "time-outline", text: "If a shop is running late, before you have to ask" },
];

/**
 * Asks permission to notify, in our words, before the OS asks in its own.
 *
 * iOS allows exactly one system prompt. Dismissed once, the only route back is
 * Settings — which almost nobody takes. So this primer exists to make sure the
 * system prompt is only ever raised after the customer has already agreed, and
 * it is shown after a FIRST ORDER rather than at launch, when there is finally
 * something concrete to be notified about.
 *
 * "Not now" is a real answer and is remembered. Nothing asks again.
 */
export function PushPrimer({ open, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [primary, secondary] = useCSSVariable(["--color-primary", "--color-text-secondary"]);

  const accept = async () => {
    await enablePush();
    onClose();
  };

  const decline = async () => {
    await declinePush();
    onClose();
  };

  return (
    <Modal animationType="none" onRequestClose={() => void decline()} transparent visible={open}>
      <Animated.View
        className="flex-1 justify-end bg-black/45"
        entering={FadeIn.duration(DURATION.enter)}
      >
        {/* Tapping the backdrop is a decline, not a dismissal that leaves the
            question hanging to be asked again next time. */}
        <Pressable accessibilityLabel="Not now" className="flex-1" onPress={() => void decline()} />

        <Animated.View
          className="rounded-t-sheet bg-elevated px-gutter pt-6 shadow-sheet"
          entering={SlideInDown.duration(DURATION.enter).springify().damping(28).stiffness(350)}
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="items-center">
            <View className="h-14 w-14 items-center justify-center rounded-pill bg-primary-soft">
              <Ionicons color={primary as string} name="notifications" size={26} />
            </View>

            <Text
              accessibilityRole="header"
              className="mt-4 text-center font-title text-title text-foreground"
            >
              Know the moment it arrives
            </Text>
            <Text className="mt-1.5 text-center font-sans text-body text-text-secondary">
              We will only message you about your own orders and offers.
            </Text>
          </View>

          <View className="mt-6 gap-3.5">
            {REASONS.map((reason) => (
              <View className="flex-row items-center gap-3" key={reason.text}>
                <Ionicons color={secondary as string} name={reason.icon} size={19} />
                <Text className="flex-1 font-sans text-label text-text-secondary">
                  {reason.text}
                </Text>
              </View>
            ))}
          </View>

          <PressableScale
            accessibilityLabel="Turn on notifications"
            accessibilityRole="button"
            className="mt-7 h-13 items-center justify-center rounded-input bg-primary"
            onPress={() => void accept()}
          >
            <Text className="font-heading text-body text-primary-foreground">
              Turn on notifications
            </Text>
          </PressableScale>

          <Pressable
            accessibilityLabel="Not now"
            accessibilityRole="button"
            className="mt-2 h-12 items-center justify-center active:opacity-60"
            onPress={() => void decline()}
          >
            <Text className="font-label text-body text-text-secondary">Not now</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
