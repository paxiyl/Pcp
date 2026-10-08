import { Stack } from "expo-router";

/**
 * Welcome, sign-in and sign-up. Onboarding runs as one continuous surface: no
 * route animation, so each screen choreographs its own content instead of
 * sliding whole pages. The session guard lives in the root layout.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ animation: "none", headerShown: false }} />;
}
