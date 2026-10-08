import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * The handover code, shown to the customer only. The rider cannot read it from
 * the API, so this card is the only place it exists on their side of the run.
 */
export function DeliveryCodeCard({ code }: { code: string }) {
  const digits = code.split("");

  return (
    <View className="items-center gap-3 rounded-card bg-primary p-5">
      <View className="flex-row items-center gap-2">
        <Ionicons color="#ffffff" name="shield-checkmark-outline" size={18} />
        <Text className="font-heading text-label text-primary-foreground">
          Confirmation code
        </Text>
      </View>

      <View
        accessibilityLabel={`Your confirmation code is ${digits.join(" ")}`}
        accessibilityRole="text"
        className="flex-row gap-3"
      >
        {digits.map((digit, index) => (
          <View
            className="h-14 w-12 items-center justify-center rounded-input bg-card"
            key={`${digit}-${index}`}
          >
            <Text className="font-title text-title text-foreground">{digit}</Text>
          </View>
        ))}
      </View>

      <Text
        className="text-center font-sans text-label text-primary-foreground"
        style={{ opacity: 0.9 }}
      >
        Read this out to your rider when your order arrives.
      </Text>
    </View>
  );
}
