import { Stack } from "expo-router";

/** Location and delivery address: signed-in only, still part of onboarding. */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ animation: "none", headerShown: false }} />;
}
