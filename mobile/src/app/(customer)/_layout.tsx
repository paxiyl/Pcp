import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { TabBarIcon } from "@/components/ui/tab-bar-icon";

/**
 * The customer tab bar.
 *
 * Five tabs: Home, Explore, Basket, Orders, Profile. A quick-commerce basket is checked far more often
 * than a food-delivery one — several small adds across a shop rather than one
 * decisive order — and the floating cart bar only appears on vendor pages, so
 * without a tab the basket is unreachable from Orders or Profile.
 *
 * 56pt plus the inset, not the 64pt default: the bar is chrome, and on a 667pt
 * screen every point it takes is a point of shelf.
 */
export default function CustomerLayout() {
  const insets = useSafeAreaInsets();
  const [primary, inactive, surface, border] = useCSSVariable([
    "--color-primary",
    "--color-text-muted",
    "--color-surface",
    "--color-border",
  ]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primary as string,
        tabBarInactiveTintColor: inactive as string,
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10, marginTop: 2 },
        tabBarStyle: {
          backgroundColor: surface as string,
          borderTopColor: border as string,
          // A hairline, not a 1pt rule: at 3x a full point reads as a grey band.
          borderTopWidth: 0.5,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon activeName="home" color={color} focused={focused} name="home-outline" />
          ),
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          // Reachable from the search field on Home and Explore, and from the
          // category header. Six tabs do not fit a 360px screen without the
          // labels truncating, and Search is the one with other doors into it.
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon activeName="grid" color={color} focused={focused} name="grid-outline" />
          ),
          title: "Explore",
        }}
      />
      <Tabs.Screen
        name="basket"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              activeName="basket"
              color={color}
              focused={focused}
              name="basket-outline"
              showBasketCount
            />
          ),
          title: "Basket",
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              activeName="receipt"
              color={color}
              focused={focused}
              name="receipt-outline"
            />
          ),
          title: "Orders",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon activeName="person" color={color} focused={focused} name="person-outline" />
          ),
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
