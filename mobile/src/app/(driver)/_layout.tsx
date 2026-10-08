import { Stack } from "expo-router";

/** Riders get a plain stack: the queue and one delivery at a time, no tabs. */
export default function DriverLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
