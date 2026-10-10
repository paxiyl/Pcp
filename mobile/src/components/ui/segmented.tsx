import { Pressable, Text, View } from "react-native";

type Props<T extends string> = {
  options: readonly T[];
  /**
   * Undefined means nothing is chosen yet, which is not the same as a default.
   * A dish's veg mark is required and must not arrive because nobody touched
   * the control, so the form that asks starts with no option selected.
   */
  value: T | undefined;
  onChange: (value: T) => void;
  label: string;
};

/** Equal-width choice chips for a small, mutually exclusive set. */
export function Segmented<T extends string>({ label, onChange, options, value }: Props<T>) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" className="flex-row gap-2">
      {options.map((option) => {
        const selected = option === value;

        return (
          <Pressable
            accessibilityLabel={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            className={`h-12 flex-1 items-center justify-center rounded-input border ${
              selected
                ? "border-primary bg-secondary"
                : "border-border bg-card active:bg-muted"
            }`}
            key={option}
            onPress={() => onChange(option)}
          >
            <Text
              className={`text-body ${
                selected ? "font-heading text-secondary-foreground" : "font-label text-foreground"
              }`}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
