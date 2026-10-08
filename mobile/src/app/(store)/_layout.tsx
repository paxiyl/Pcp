import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { TabBarIcon } from "@/components/ui/tab-bar-icon";

/**
 * The shopkeeper's app.
 *
 * Three tabs, not five. A shop owner opens this to answer one of three
 * questions — what is waiting, what is on the shelf, and is my shop open — and
 * padding that out with discovery surfaces borrowed from the customer app would
 * only bury them.
 *
 * Same tokens as the storefront, different density: no imagery, no rails, and
 * numbers set in tabular figures because this screen is read, not browsed.
 */
export default function StoreLayout() {
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
          borderTopWidth: 0.5,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="store-dashboard"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon activeName="home" color={color} focused={focused} name="home-outline" />
          ),
          title: "Counter",
        }}
      />
      <Tabs.Screen
        name="store-orders"
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
        name="store-inventory"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon activeName="cube" color={color} focused={focused} name="cube-outline" />
          ),
          title: "Shelf",
        }}
      />
    </Tabs>
  );
}
