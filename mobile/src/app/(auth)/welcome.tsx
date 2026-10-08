import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Alert, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { Wordmark } from "@/components/ui/wordmark";
import { BRAND } from "@/lib/brand";
import { useEnter } from "@/lib/motion";

/** The breadth of the catalogue, as the first thing anyone reads. */
const DEPARTMENTS = [
  "Groceries",
  "Medicine",
  "Cosmetics",
  "Clothing",
  "Electronics",
  "Baby care",
  "Household",
  "Stationery",
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const enter = useEnter();
  const [headerFrom, headerTo] = useCSSVariable(["--color-header-from", "--color-header-to"]);

  const showSocialStub = (provider: string) => {
    Alert.alert(
      `${provider} sign-in is coming soon`,
      "Continue with email for now — it takes about a minute.",
    );
  };

  return (
    <View className="flex-1 bg-foreground">
      <LinearGradient
        colors={[headerFrom as string, headerTo as string, "#0A1B10"]}
        locations={[0, 0.45, 1]}
        style={{ flex: 1 }}
      >
        <View
          className="flex-1 justify-end px-5"
          style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 24 }}
        >
          {/* What is actually sold here, stated before the buttons. A customer
              who thinks this is a food app will never look for a phone charger. */}
          <Animated.View className="mb-auto justify-center" entering={enter()} style={{ flex: 1 }}>
            <View className="flex-row flex-wrap gap-2">
              {DEPARTMENTS.map((label) => (
                <View className="rounded-pill bg-white/15 px-3 py-1.5" key={label}>
                  <Text className="font-label text-label text-white">{label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={enter()}>
            <Wordmark size="hero" tone="inverse" />
          </Animated.View>

          <Animated.View className="mt-3" entering={enter()}>
            <Text className="font-title text-title text-white">{BRAND.taglineEn}</Text>
            <Text className="mt-1 font-sans text-body text-white/75">
              {BRAND.city}, {BRAND.region}
            </Text>
          </Animated.View>

          <Animated.View className="mt-9 gap-3" entering={enter()}>
            <Button label="Continue with email" onPress={() => router.push("/sign-up")} />
            <Button
              icon={<GoogleIcon />}
              label="Continue with Google"
              onPress={() => showSocialStub("Google")}
              variant="outline-inverse"
            />
          </Animated.View>

          <Animated.View className="mt-5 flex-row items-center justify-center" entering={enter()}>
            <Text className="font-sans text-body text-white/80">Already have an account? </Text>
            <Text
              accessibilityRole="link"
              className="font-heading text-body text-white"
              onPress={() => router.push("/sign-in")}
              suppressHighlighting
            >
              Log in
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}
