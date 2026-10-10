import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useImagePresets } from "@/features/catalogue/use-image-presets";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  /** Food presets for a kitchen, grocery presets for a shop. */
  catalogue: "food" | "grocery";
  /** The chosen key, or "" for none. */
  value: string;
  onChange: (key: string) => void;
};

/**
 * Choosing a tile instead of taking a photograph.
 *
 * A shopkeeper adding twenty items in an evening is not going to photograph
 * twenty items, and a listing with no picture renders as a grey square, which
 * reads as broken rather than as "no photo yet". So the picture is a choice from
 * a fixed set — one tap, and the shelf looks deliberate.
 *
 * The list comes from the API rather than the bundle, so a new preset does not
 * need a new build of the app. While it is loading the row is skeletons, and if
 * it never arrives the form still submits: no preset is a valid answer.
 */
export function PresetPicker({ catalogue, onChange, value }: Props) {
  const { data: presets, isLoading } = useImagePresets();

  const options = (presets ?? []).filter((preset) => preset.catalogue === catalogue);

  return (
    <View className="gap-2">
      <Text className="font-label text-label text-foreground">Picture</Text>

      {isLoading ? (
        <View className="flex-row gap-2">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton className="h-18 w-18 rounded-input" key={key} />
          ))}
        </View>
      ) : options.length === 0 ? (
        <Text className="font-sans text-caption text-text-muted">
          No tiles available right now. You can add this without a picture.
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {/* "None" first, and selected by default: the form must not require a choice. */}
          <Pressable
            accessibilityLabel="No picture"
            accessibilityRole="radio"
            accessibilityState={{
              checked: value === "",
              selected: value === "",
            }}
            className={`h-18 w-18 items-center justify-center rounded-input border-2 bg-card ${
              value === "" ? "border-primary" : "border-border"
            }`}
            onPress={() => onChange("")}
          >
            <Text className="font-label text-caption text-text-muted">None</Text>
          </Pressable>

          {options.map((preset) => {
            const selected = preset.key === value;

            return (
              <Pressable
                accessibilityLabel={preset.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, selected }}
                className={`h-18 w-18 overflow-hidden rounded-input border-2 ${
                  selected ? "border-primary" : "border-transparent"
                }`}
                key={preset.key}
                onPress={() => onChange(preset.key)}
              >
                <LinearGradient
                  colors={preset.colors}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={{
                    alignItems: "center",
                    flex: 1,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={{ fontSize: 30 }}
                  >
                    {preset.glyph}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
