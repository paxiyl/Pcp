import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { TabBarIcon } from "@/components/ui/tab-bar-icon";

/**
 * The kitchen's app.
 *
 * The counterpart of the shopkeeper's three tabs, and deliberately the same
 * shape: a kitchen opens this to answer what is waiting, what is on the menu,
 * and am I taking orders. The difference is what "shelf" means — a shop counts
 * stock, a kitchen switches a dish off when it runs out mid-service and back on
 * tomorrow.
 */
export default function KitchenLayout() {
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
        name="kitchen-counter"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              activeName="restaurant"
              color={color}
              focused={focused}
              name="restaurant-outline"
            />
          ),
          title: "Kitchen",
        }}
      />
      <Tabs.Screen
        name="kitchen-orders"
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
        name="kitchen-menu"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              activeName="fast-food"
              color={color}
              focused={focused}
              name="fast-food-outline"
            />
          ),
          title: "Menu",
        }}
      />
    </Tabs>
  );
}
