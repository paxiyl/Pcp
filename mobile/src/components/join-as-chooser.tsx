import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { PartnerRole } from "@/lib/api";

export type JoinAs = "customer" | PartnerRole;

const OPTIONS: { value: JoinAs; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { icon: "bag-handle-outline", label: "Shopping", value: "customer" },
  { icon: "bicycle-outline", label: "Delivering", value: "driver" },
  { icon: "storefront-outline", label: "A shop", value: "store_owner" },
  { icon: "restaurant-outline", label: "A kitchen", value: "restaurant_owner" },
];

type Props = {
  value: JoinAs;
  onChange: (next: JoinAs) => void;
};

/**
 * What someone is signing up to do.
 *
 * Anything but "Shopping" still creates an ordinary customer account and files
 * an application alongside it. Picking a tile here cannot grant a role — only
 * an admin approving the application does that — so the copy promises a review
 * rather than access.
 */
export function JoinAsChooser({ value, onChange }: Props) {
  const [primaryVar, mutedVar] = useCSSVariable(["--color-primary", "--color-text-muted"]);

  const primary = typeof primaryVar === "string" ? primaryVar : "#116e3c";
  const muted = typeof mutedVar === "string" ? mutedVar : "#6b7280";

  return (
    <View className="gap-2">
      <Text className="font-label text-label text-muted-foreground">I am joining to</Text>

      <View className="flex-row flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`flex-1 basis-[46%] flex-row items-center gap-2 rounded-card border px-3 py-3 ${
                selected ? "border-primary bg-primary-soft" : "border-border bg-card"
              }`}
              key={option.value}
              onPress={() => onChange(option.value)}
            >
              <Ionicons
                color={selected ? primary : muted}
                name={option.icon}
                size={18}
              />
              <Text
                className={`font-title text-label ${
                  selected ? "text-primary" : "text-card-foreground"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value !== "customer" ? (
        <Text className="font-sans text-caption text-muted-foreground">
          You will shop as a customer straight away. We review partner requests by hand and will be
          in touch.
        </Text>
      ) : null}
    </View>
  );
}
