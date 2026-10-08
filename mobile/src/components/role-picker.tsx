import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import type { AppRole } from "@/lib/api";

type Props = {
  value: AppRole;
  onChange: (role: AppRole) => void;
};

const ROLES: {
  role: AppRole;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { hint: "Shop and track orders", icon: "bag-handle-outline", label: "Customer", role: "customer" },
  { hint: "Manage your shop", icon: "storefront-outline", label: "Store owner", role: "store_owner" },
  { hint: "Pick up and deliver", icon: "bicycle-outline", label: "Delivery partner", role: "driver" },
];

/**
 * Which experience to open after signing in.
 *
 * This chooses a DESTINATION, not a permission. The server compares the choice
 * with the role stored on the account and refuses a mismatch; a picker that
 * could grant a role would be an authorisation hole with a dropdown in front of
 * it. Admins are absent on purpose — they sign in on the backoffice.
 *
 * It exists because one app serves three jobs, and a rider who has to hunt for
 * their queue behind a customer home screen will assume the app is broken.
 */
export function RolePicker({ value, onChange }: Props) {
  const [primary, secondary] = useCSSVariable(["--color-primary", "--color-text-secondary"]);

  return (
    <View accessibilityRole="radiogroup" className="flex-row gap-2">
      {ROLES.map((option) => {
        const selected = option.role === value;

        return (
          <Pressable
            accessibilityHint={option.hint}
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            className={`flex-1 items-center gap-1.5 rounded-input border px-2 py-3 ${
              selected ? "border-primary bg-primary-soft" : "border-border bg-surface active:bg-muted"
            }`}
            key={option.role}
            onPress={() => onChange(option.role)}
          >
            <Ionicons
              color={(selected ? primary : secondary) as string}
              name={option.icon}
              size={22}
            />
            <Text
              className={`text-center text-caption ${
                selected ? "font-heading text-primary" : "font-label text-text-secondary"
              }`}
              numberOfLines={2}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
