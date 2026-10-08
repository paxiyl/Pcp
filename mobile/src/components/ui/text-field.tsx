import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { Pressable, Text, TextInput, type TextInputProps, View } from "react-native";
import { useCSSVariable } from "uniwind";

type Props = TextInputProps & {
  label: string;
  error?: string;
  secure?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, secure = false, ...inputProps },
  ref,
) {
  const [hidden, setHidden] = useState(secure);
  const [subtle, foreground] = useCSSVariable(["--color-subtle-foreground", "--color-foreground"]);

  return (
    <View className="gap-2">
      <Text className="font-label text-label text-foreground">{label}</Text>
      <View
        className={`h-13 flex-row items-center rounded-input border bg-card px-4 ${
          error ? "border-destructive" : "border-border"
        }`}
      >
        <TextInput
          accessibilityLabel={label}
          className="flex-1 font-sans text-body text-foreground"
          placeholderTextColor={subtle as string}
          ref={ref}
          secureTextEntry={hidden}
          selectionColor={foreground as string}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            accessibilityRole="button"
            className="-mr-2 h-11 w-11 items-center justify-center"
            hitSlop={8}
            onPress={() => setHidden((value) => !value)}
          >
            <Ionicons color={subtle as string} name={hidden ? "eye-outline" : "eye-off-outline"} size={20} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="font-label text-label text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
