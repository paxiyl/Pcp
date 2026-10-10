import "../global.css";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaListener, SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind, useCSSVariable, useUniwind } from "uniwind";

import { AppToaster } from "@/components/app-toaster";
import { DeliveryModeProvider } from "@/features/mode/delivery-mode";
import { useProtectedRoute } from "@/features/auth/use-protected-route";
import { getStoredTheme } from "@/features/settings/theme-preference";
import { queryClient } from "@/lib/query-client";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const { theme, hasAdaptiveThemes } = useUniwind();
  const [background, card, foreground, border, primary, notification, muted] = useCSSVariable([
    "--color-background",
    "--color-card",
    "--color-foreground",
    "--color-border",
    "--color-primary",
    "--color-accent",
    "--color-muted-foreground",
  ]);
  const dark = theme === "dark";
  const toasterTheme = hasAdaptiveThemes ? "system" : theme;

  const navigationTheme = useMemo(
    () => ({
      ...(dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(dark ? DarkTheme.colors : DefaultTheme.colors),
        background: background as string,
        card: card as string,
        text: foreground as string,
        border: border as string,
        primary: primary as string,
        notification: notification as string,
      },
    }),
    [background, border, card, dark, foreground, notification, primary],
  );

  // Restoring the saved theme must never hold up the launch: a keystore read
  // that stalls would leave the app on a blank frame until Android kills it.
  useEffect(() => {
    void getStoredTheme().then((preference) => {
      if (preference !== "system") Uniwind.setTheme(preference);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ProtectedRoutes />
        {/* Above the navigator: the chosen mode has to survive moving between
            screens, not reset every time home unmounts. */}
        <DeliveryModeProvider>
        <SafeAreaProvider>
          <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
            <ThemeProvider value={navigationTheme}>
              <View className="flex-1 bg-background">
                <StatusBar style={dark ? "light" : "dark"} />
                <Stack screenOptions={{ headerShown: false }}>
                  {/*
                   * The restaurant page lives on the root stack, not the tabs, so it
                   * covers the tab bar, sliding up from the bottom. The same
                   * animation runs on both platforms.
                   */}
                  <Stack.Screen
                    name="restaurant/[slug]"
                    options={{ animation: "slide_from_bottom" }}
                  />
                  {/* Dish customisation is a sheet over the menu. */}
                  <Stack.Screen name="dish/[id]" options={{ presentation: "modal" }} />
                  <Stack.Screen name="checkout" options={{ animation: "slide_from_right" }} />
                  <Stack.Screen name="order/[id]" options={{ animation: "slide_from_right" }} />
                  {/* A settings page pushed from the profile tab, so it covers
                      the tab bar and comes back with a normal back gesture. */}
                  <Stack.Screen
                    name="payment-methods"
                    options={{ animation: "slide_from_right" }}
                  />
                  <Stack.Screen
                    name="application-status"
                    options={{ animation: "slide_from_right" }}
                  />
                  {/* Tracking rises over the order it belongs to. */}
                  <Stack.Screen name="track/[id]" options={{ animation: "slide_from_bottom" }} />
                  {/* Confirmation is an arrival, not a step you can go back into. */}
                  <Stack.Screen
                    name="order-confirmed"
                    options={{ animation: "fade", gestureEnabled: false }}
                  />
                </Stack>
                <AppToaster
                  background={card as string}
                  border={border as string}
                  foreground={foreground as string}
                  muted={muted as string}
                  theme={toasterTheme}
                />
              </View>
            </ThemeProvider>
          </SafeAreaListener>
          </SafeAreaProvider>
        </DeliveryModeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Mounted inside the providers so it can read the session. Renders nothing. */
function ProtectedRoutes() {
  useProtectedRoute();

  return null;
}
