import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { Screen } from "@/components/ui/screen";
import {
  usePaymentPreferences,
  useSetPaymentPreference,
} from "@/features/payments/use-payment-preferences";
import type { PaymentMethod } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { toast } from "@/lib/sonner";

type Copy = {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * UPI first, because in Hindaun it is how most people actually pay. Ordering
 * this list by what the business prefers rather than what the customer uses is
 * how you lose the sale on the last screen.
 */
const COPY: Record<PaymentMethod, Copy> = {
  card: { hint: "Visa, Mastercard, RuPay", icon: "card-outline", label: "Card" },
  cod: {
    hint: "Hand the cash to your rider at the door",
    icon: "cash-outline",
    label: "Cash on delivery",
  },
  netbanking: { hint: "All major banks", icon: "business-outline", label: "Netbanking" },
  upi: { hint: "GPay, PhonePe, Paytm", icon: "phone-portrait-outline", label: "UPI" },
  wallet: { hint: "Paytm, Amazon Pay", icon: "wallet-outline", label: "Wallet" },
};

/** The order the rows appear in, independent of the server's enum order. */
const ORDER: PaymentMethod[] = ["upi", "card", "netbanking", "wallet", "cod"];

/**
 * Payment methods.
 *
 * This used to be an Alert.alert that said "you choose at checkout" and did
 * nothing — which was true, and useless, because checkout then opened on UPI
 * whatever the customer actually used. Choosing here is the whole point: it is
 * the method checkout starts on.
 *
 * What is deliberately NOT here is a stored card or UPI handle. Keeping an
 * instrument means holding something worth stealing, and the gateway already
 * does that properly; this screen stores a preference, not a credential, and
 * says so on the page rather than in a privacy policy nobody opens.
 */
export default function PaymentMethodsScreen() {
  const router = useRouter();
  const [primary, secondary, muted, foreground] = useCSSVariable([
    "--color-primary",
    "--color-text-secondary",
    "--color-text-muted",
    "--color-foreground",
  ]);

  const { data, isLoading } = usePaymentPreferences();
  const save = useSetPaymentPreference();

  const choose = (method: PaymentMethod) => {
    if (method === data?.preferred || save.isPending) return;

    haptics.selection();
    save.mutate(
      { method },
      {
        onError: (error) =>
          toast.error("We could not save that", { description: error.message }),
      },
    );
  };

  const header = (
    <View className="flex-row items-center px-gutter py-3">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        className="-ml-2 h-11 w-11 items-center justify-center"
        hitSlop={8}
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/profile"))}
      >
        <Ionicons color={foreground as string} name="arrow-back" size={24} />
      </Pressable>
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-title text-title text-foreground"
      >
        Payment methods
      </Text>
      <View className="h-11 w-11" />
    </View>
  );

  if (isLoading || !data) {
    return (
      <Screen edges={["top"]}>
        {header}
        <View className="gap-3 px-gutter pt-4">
          {ORDER.map((method) => (
            <View
              className="h-18 flex-row items-center gap-3 rounded-input border border-border p-3"
              key={method}
            >
              <View className="h-9 w-9 rounded-pill bg-muted" />
              <View className="flex-1 gap-2">
                <View className="h-4 w-24 rounded-input bg-muted" />
                <View className="h-3 w-36 rounded-input bg-muted" />
              </View>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  const byMethod = new Map(data.methods.map((option) => [option.method, option]));

  return (
    <Screen edges={["top"]}>
      {header}

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Text className="px-gutter pb-5 font-sans text-body text-text-secondary">
          Pick what checkout should open on. You can still change it on any
          single order.
        </Text>

        <View accessibilityRole="radiogroup" className="gap-2 px-gutter">
          {ORDER.map((method) => {
            const option = byMethod.get(method);
            const available = option?.available ?? true;
            const selected = data.preferred === method && available;
            const copy = COPY[method];
            const hint = available ? copy.hint : (option?.reason ?? "Not available right now");

            return (
              <Pressable
                accessibilityHint={hint}
                accessibilityLabel={copy.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !available, selected }}
                className={`flex-row items-center gap-3 rounded-input border p-3.5 ${
                  selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
                } ${available ? "active:bg-muted" : "opacity-50"}`}
                disabled={!available || save.isPending}
                key={method}
                onPress={() => choose(method)}
              >
                <Ionicons
                  color={(selected ? primary : secondary) as string}
                  name={copy.icon}
                  size={22}
                />

                <View className="flex-1">
                  <Text
                    className={`text-body ${
                      selected ? "font-heading text-primary" : "font-label text-foreground"
                    }`}
                  >
                    {copy.label}
                  </Text>
                  <Text className="font-sans text-caption text-text-muted">{hint}</Text>
                </View>

                {save.isPending && save.variables?.method === method ? (
                  <ActivityIndicator color={primary as string} size="small" />
                ) : (
                  <View
                    className={`items-center justify-center rounded-pill border-2 ${
                      selected ? "border-primary" : "border-border"
                    }`}
                    style={{ height: 22, width: 22 }}
                  >
                    {selected ? (
                      <View className="rounded-pill bg-primary" style={{ height: 11, width: 11 }} />
                    ) : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* The cash ceiling, stated up front rather than discovered at checkout. */}
        {data.cod.maxOrderValue > 0 ? (
          <View className="mx-gutter mt-5 flex-row gap-3 rounded-card bg-muted p-4">
            <Ionicons color={muted as string} name="information-circle-outline" size={20} />
            <Text className="flex-1 font-sans text-label text-text-secondary">
              Cash works on orders up to {formatPrice(data.cod.maxOrderValue)}, and on one order
              at a time. Above that, pay by UPI or card.
            </Text>
          </View>
        ) : null}

        <View className="mx-gutter mt-3 flex-row gap-3 rounded-card bg-muted p-4">
          <Ionicons color={muted as string} name="lock-closed-outline" size={20} />
          <Text className="flex-1 font-sans text-label text-text-secondary">
            We store which kind of payment you prefer — never a card number or a UPI ID. Those stay
            with Razorpay, who handle the payment itself.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
