import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useCSSVariable, useUniwind } from "uniwind";

import { PushPrimer } from "@/components/push-primer";
import { Screen } from "@/components/ui/screen";
import { useCurrentUser, useLogout } from "@/features/auth/use-auth";
import { useDefaultAddress } from "@/features/location/use-addresses";
import { useOrders } from "@/features/orders/use-orders";
import { getPushChoice, type PushChoice } from "@/features/settings/notifications";
import { applyTheme } from "@/features/settings/theme-preference";
import { BRAND } from "@/lib/brand";

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
  /** Destructive rows are red and always confirmed before acting. */
  tone?: "default" | "danger";
};

/**
 * Profile.
 *
 * Grouped under real headings rather than three stacked cards that all look the
 * same — the brief's loudest complaint, and this screen was the clearest example
 * of it. A heading costs 20pt and tells you what the rows below have in common,
 * which a shared border never does.
 *
 * Rows are hairline-separated inside a group and the groups float on the canvas,
 * so the page reads as four short lists instead of one long undifferentiated one.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const { data: address } = useDefaultAddress();
  const { data: orders } = useOrders();
  const logout = useLogout();
  const { theme } = useUniwind();

  const [pushChoice, setPushChoice] = useState<PushChoice>("unasked");
  const [primerOpen, setPrimerOpen] = useState(false);

  const [primary, secondary, muted, destructive, border, surface] = useCSSVariable([
    "--color-primary",
    "--color-text-secondary",
    "--color-text-muted",
    "--color-destructive",
    "--color-border",
    "--color-surface",
  ]);

  const dark = theme === "dark";

  useEffect(() => {
    void getPushChoice().then(setPushChoice);
  }, [primerOpen]);

  const orderCount = orders?.length ?? 0;
  const activeOrder = orders?.find(
    (order) =>
      order.status !== "delivered" &&
      order.status !== "cancelled" &&
      order.status !== "payment_failed",
  );

  /**
   * Logging out is destructive on a phone: the session token is the only thing
   * standing between the customer and re-entering a password they may not
   * remember. It is always confirmed.
   */
  const confirmLogout = () =>
    Alert.alert("Log out?", "You will need to sign in again to see your orders.", [
      { style: "cancel", text: "Stay signed in" },
      { onPress: () => logout.mutate(), style: "destructive", text: "Log out" },
    ]);

  const groups: { title: string; rows: Row[] }[] = [
    {
      rows: [
        {
          detail: orderCount > 0 ? `${orderCount} order${orderCount === 1 ? "" : "s"}` : "None yet",
          icon: "receipt-outline",
          label: "Your orders",
          onPress: () => router.push("/orders"),
        },
        {
          detail: address ? `${address.label} · ${address.line1}` : "Add one for faster checkout",
          icon: "location-outline",
          label: "Delivery addresses",
          onPress: () => router.push("/address"),
        },
      ],
      title: "Orders & delivery",
    },
    {
      rows: [
        {
          detail:
            pushChoice === "granted"
              ? "On"
              : pushChoice === "declined"
                ? "Off · tap to turn on"
                : "Get order updates",
          icon: "notifications-outline",
          label: "Notifications",
          // Once the OS prompt has been answered, only Settings can change it.
          onPress: () =>
            pushChoice === "granted" ? void Linking.openSettings() : setPrimerOpen(true),
        },
        {
          detail: "UPI, cards and cash on delivery",
          icon: "card-outline",
          label: "Payment methods",
          onPress: () =>
            Alert.alert(
              "Payment methods",
              "You choose how to pay at checkout — UPI, card, netbanking, wallet or cash on delivery. Nothing is stored on your phone.",
            ),
        },
      ],
      title: "Preferences",
    },
    {
      rows: [
        {
          detail: BRAND.supportEmail,
          icon: "chatbubble-ellipses-outline",
          label: "Help & support",
          onPress: () => void Linking.openURL(`mailto:${BRAND.supportEmail}`),
        },
        {
          detail: `${BRAND.fullName} · ${BRAND.region}`,
          icon: "information-circle-outline",
          label: "About OnlineMall",
          onPress: () =>
            Alert.alert(BRAND.fullName, `${BRAND.taglineEn}\n\nServing ${BRAND.city}, ${BRAND.region}.`),
        },
      ],
      title: "Support",
    },
    {
      rows: [
        {
          icon: "log-out-outline",
          label: "Log out",
          onPress: confirmLogout,
          tone: "danger",
        },
      ],
      title: "Account",
    },
  ];

  return (
    <Screen edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="px-gutter pt-4">
          <Text accessibilityRole="header" className="font-title text-display text-foreground">
            Profile
          </Text>
        </View>

        {/* Identity, edge to edge rather than boxed: it is not a list row. */}
        <View className="flex-row items-center gap-4 px-gutter pt-5">
          <View className="h-16 w-16 items-center justify-center rounded-pill bg-primary-soft">
            <Text className="font-title text-display text-primary">
              {(user?.name ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-title text-title text-foreground" numberOfLines={1}>
              {user?.name ?? "Your account"}
            </Text>
            <Text className="font-sans text-label text-text-secondary" numberOfLines={1}>
              {user?.email ?? "Signed in on this device"}
            </Text>
            {user?.phone ? (
              <Text className="font-sans text-caption text-text-muted">{user.phone}</Text>
            ) : null}
          </View>
        </View>

        {/* An order in flight is the single most useful thing this screen can
            offer, so it sits above the lists rather than inside one. */}
        {activeOrder ? (
          <Pressable
            accessibilityHint="Opens live tracking"
            accessibilityLabel={`Track order ${activeOrder.reference}`}
            accessibilityRole="button"
            className="mx-gutter mt-5 flex-row items-center gap-3 rounded-card bg-primary p-3.5 active:opacity-90"
            onPress={() => router.push({ params: { id: activeOrder._id }, pathname: "/track/[id]" })}
          >
            <Ionicons color="#ffffff" name="bicycle" size={22} />
            <View className="flex-1">
              <Text className="font-heading text-label text-primary-foreground">
                Order on the way
              </Text>
              <Text className="font-sans text-caption text-primary-foreground opacity-85">
                {activeOrder.restaurantName} · {activeOrder.reference}
              </Text>
            </View>
            <Ionicons color="#ffffff" name="chevron-forward" size={18} />
          </Pressable>
        ) : null}

        {groups.map((group) => (
          <View className="pt-7" key={group.title}>
            <Text
              className="px-gutter pb-2 font-label text-caption uppercase text-text-muted"
              style={{ letterSpacing: 1.2 }}
            >
              {group.title}
            </Text>

            <View className="mx-gutter overflow-hidden rounded-card bg-surface">
              {group.rows.map((row, index) => {
                const danger = row.tone === "danger";

                return (
                  <Pressable
                    accessibilityLabel={row.label}
                    accessibilityRole="button"
                    className={`flex-row items-center gap-3.5 px-4 py-3.5 active:bg-muted ${
                      index > 0 ? "divider-hairline border-t-0" : ""
                    }`}
                    key={row.label}
                    onPress={row.onPress}
                    style={index > 0 ? { borderTopColor: border as string, borderTopWidth: 0.5 } : undefined}
                  >
                    <Ionicons
                      color={(danger ? destructive : primary) as string}
                      name={row.icon}
                      size={21}
                    />
                    <View className="flex-1">
                      <Text
                        className={`font-label text-body ${
                          danger ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {row.label}
                      </Text>
                      {row.detail ? (
                        <Text
                          className="font-sans text-caption text-text-muted"
                          numberOfLines={1}
                        >
                          {row.detail}
                        </Text>
                      ) : null}
                    </View>
                    {!danger ? (
                      <Ionicons color={muted as string} name="chevron-forward" size={17} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Appearance is a control, not a destination, so it never gets a chevron. */}
        <View className="pt-7">
          <Text
            className="px-gutter pb-2 font-label text-caption uppercase text-text-muted"
            style={{ letterSpacing: 1.2 }}
          >
            Appearance
          </Text>

          <View className="mx-gutter flex-row items-center gap-3.5 rounded-card bg-surface px-4 py-3">
            <Ionicons color={primary as string} name="moon-outline" size={21} />
            <View className="flex-1">
              <Text className="font-label text-body text-foreground">Dark mode</Text>
              <Text className="font-sans text-caption text-text-muted">
                {dark ? "On" : "Following your phone settings"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Dark mode"
              ios_backgroundColor={border as string}
              onValueChange={(value) => void applyTheme(value ? "dark" : "light")}
              thumbColor={surface as string}
              trackColor={{ false: border as string, true: primary as string }}
              value={dark}
            />
          </View>
        </View>

        <Text className="px-gutter pt-8 text-center font-sans text-caption text-text-muted">
          {BRAND.fullName}
        </Text>
        <Text className="px-gutter pt-0.5 text-center font-sans text-caption text-text-muted">
          {BRAND.tagline}
        </Text>
      </ScrollView>

      <PushPrimer onClose={() => setPrimerOpen(false)} open={primerOpen} />
    </Screen>
  );
}
