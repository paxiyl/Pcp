import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { BasketPaymentOptions, PaymentMethod } from "@/lib/api";

type Props = {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  options: BasketPaymentOptions;
};

type Row = {
  method: PaymentMethod;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/**
 * UPI is first and default. In Hindaun it is how most people actually pay, and
 * ordering a payment list by what the merchant prefers rather than what the
 * customer uses is how you lose the sale on the last screen.
 */
const ROWS: Row[] = [
  { icon: "phone-portrait-outline", hint: "GPay, PhonePe, Paytm", label: "UPI", method: "upi" },
  { icon: "card-outline", hint: "Visa, Mastercard, RuPay", label: "Card", method: "card" },
  { icon: "business-outline", hint: "All major banks", label: "Netbanking", method: "netbanking" },
  { icon: "wallet-outline", hint: "Paytm, Amazon Pay", label: "Wallet", method: "wallet" },
  { icon: "cash-outline", hint: "Pay the rider at your door", label: "Cash on delivery", method: "cod" },
];

/**
 * Payment choice.
 *
 * A method the customer cannot use is shown disabled WITH its reason rather than
 * hidden. Hiding it raises "where did cash go?"; showing it refused at submit
 * wastes the whole form. The reason comes from the server, which also enforces
 * it — this picker is the explanation, not the guard.
 */
export function PaymentMethodPicker({ value, onChange, options }: Props) {
  const [primary, secondary, muted] = useCSSVariable([
    "--color-primary",
    "--color-text-secondary",
    "--color-text-muted",
  ]);

  return (
    <View accessibilityRole="radiogroup" className="gap-2">
      {ROWS.map((row) => {
        // Cash is ours to refuse; the other four need a gateway with keys AND a
        // build that carries its SDK. Both answers arrive on `options`, already
        // combined, so this stays the explanation rather than a second guard.
        const disabled =
          row.method === "cod" ? !options.codAvailable : !options.onlineAvailable;
        const selected = row.method === value && !disabled;
        const reason =
          row.method === "cod" ? options.codUnavailableReason : options.onlineUnavailableReason;
        const hint = disabled ? (reason ?? "Not available") : row.hint;

        return (
          <Pressable
            accessibilityHint={hint}
            accessibilityLabel={row.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled, selected }}
            className={`flex-row items-center gap-3 rounded-input border p-3 ${
              selected ? "border-primary bg-primary-soft" : "border-border bg-surface"
            } ${disabled ? "opacity-50" : "active:bg-muted"}`}
            disabled={disabled}
            key={row.method}
            onPress={() => onChange(row.method)}
          >
            <Ionicons
              color={(selected ? primary : secondary) as string}
              name={row.icon}
              size={22}
            />

            <View className="flex-1">
              <Text
                className={`text-body ${
                  selected ? "font-heading text-primary" : "font-label text-foreground"
                }`}
              >
                {row.label}
              </Text>
              <Text className="font-sans text-caption text-text-muted">{hint}</Text>
            </View>

            {/* A real radio rather than a checkmark: these are exclusive, and the
                empty ring is what makes the unselected rows read as choosable. */}
            <View
              className={`items-center justify-center rounded-pill border-2 ${
                selected ? "border-primary" : "border-border"
              }`}
              style={{ height: 22, width: 22 }}
            >
              {selected ? (
                <View
                  className="rounded-pill bg-primary"
                  style={{ height: 11, width: 11 }}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <View className="mt-1 flex-row items-center gap-1.5 px-1">
        <Ionicons color={muted as string} name="lock-closed" size={11} />
        <Text className="font-sans text-caption text-text-muted">
          Payments are encrypted and handled by Razorpay. We never see your card details.
        </Text>
      </View>
    </View>
  );
}
