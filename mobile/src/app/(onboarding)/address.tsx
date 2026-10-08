import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  type TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { TextField } from "@/components/ui/text-field";
import {
  useAddresses,
  useCreateAddress,
  useDefaultAddress,
  useUpdateAddress,
} from "@/features/location/use-addresses";
import type { AddressLabel } from "@/lib/api";
import { useEnter } from "@/lib/motion";
import { toast } from "@/lib/sonner";

const mapPreview = require("@/assets/images/app-imgs/map-card.png");

const LABELS = ["Home", "Work", "Other"] as const;

type Field = "line1" | "city" | "postcode";

export default function AddressScreen() {
  const router = useRouter();
  const enter = useEnter();
  const { data: addresses } = useAddresses();
  const { data: defaultAddress } = useDefaultAddress();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const params = useLocalSearchParams<{
    city?: string;
    id?: string;
    latitude?: string;
    line1?: string;
    longitude?: string;
    mode?: string;
    postcode?: string;
  }>();
  const cityRef = useRef<TextInput>(null);
  const postcodeRef = useRef<TextInput>(null);
  const instructionsRef = useRef<TextInput>(null);
  const [foreground] = useCSSVariable(["--color-foreground"]);
  // Screen gutter is px-5 on both sides, so the map fills the content column.
  const mapWidth = useWindowDimensions().width - 40;

  /**
   * Three ways in: an id edits that address, "new" starts a blank one, and
   * onboarding arrives with neither and edits whatever is already saved.
   */
  const saved =
    params.id ? addresses?.find((address) => address._id === params.id)
    : params.mode === "new" ? undefined
    : defaultAddress;

  const prefilled = Boolean(params.line1);
  const isPending = createAddress.isPending || updateAddress.isPending;

  const [label, setLabel] = useState<AddressLabel>(saved?.label ?? "Home");
  const [values, setValues] = useState({
    city: params.city ?? saved?.city ?? "",
    instructions: saved?.instructions ?? "",
    line1: params.line1 ?? saved?.line1 ?? "",
    postcode: params.postcode ?? saved?.postcode ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const hydrated = useRef<string>("");

  // The list resolves after mount, so an edit fills its fields once it lands.
  useEffect(() => {
    if (!saved || hydrated.current === saved._id) return;

    hydrated.current = saved._id;
    setLabel(saved.label);
    setValues({
      city: params.city ?? saved.city,
      instructions: saved.instructions ?? "",
      line1: params.line1 ?? saved.line1,
      postcode: params.postcode ?? saved.postcode,
    });
  }, [params.city, params.line1, params.postcode, saved]);

  const setField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      field in current ? { ...current, [field as Field]: undefined } : current,
    );
  };

  const handleSave = () => {
    if (isPending) return;

    const nextErrors: Partial<Record<Field, string>> = {};
    if (!values.line1.trim()) nextErrors.line1 = "Enter your street and building";
    if (!values.city.trim()) nextErrors.city = "Enter your city or town";
    if (!values.postcode.trim()) nextErrors.postcode = "Enter your postcode";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = {
      city: values.city.trim(),
      instructions: values.instructions.trim() || undefined,
      isDefault: saved ? saved.isDefault : true,
      label,
      latitude: params.latitude ? Number(params.latitude) : saved?.location?.coordinates[1],
      line1: values.line1.trim(),
      longitude: params.longitude ? Number(params.longitude) : saved?.location?.coordinates[0],
      postcode: values.postcode.trim(),
    };

    const onSuccess = () => {
      toast.success("Delivery address saved", { description: `${input.line1}, ${input.city}` });
      router.back();
    };

    const onError = (error: Error) =>
      toast.error("We could not save your address", { description: error.message });

    // Editing the saved address updates it; otherwise this is a new one.
    if (saved) {
      updateAddress.mutate({ ...input, id: saved._id }, { onError, onSuccess });
    } else {
      createAddress.mutate(input, { onError, onSuccess });
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="grow px-5 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            className="-ml-2 h-11 w-11 items-center justify-center"
            hitSlop={8}
            onPress={() => router.back()}
          >
            <Ionicons color={foreground as string} name="arrow-back" size={24} />
          </Pressable>

          <Animated.View className="mt-4 gap-2" entering={enter()}>
            <Text accessibilityRole="header" className="font-title text-display text-foreground">
              Delivery address
            </Text>
            {prefilled ? (
              <View className="flex-row items-center gap-2">
                <Ionicons color={foreground as string} name="navigate-circle-outline" size={18} />
                <Text className="font-label text-label text-muted-foreground">
                  Prefilled from your current location — check it before saving.
                </Text>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View className="mt-7 gap-4" entering={enter()}>
            <Segmented label="Address label" onChange={setLabel} options={LABELS} value={label} />

            <TextField
              autoCapitalize="words"
              autoComplete="street-address"
              error={errors.line1}
              label="Address line 1"
              onChangeText={(value) => setField("line1", value)}
              onSubmitEditing={() => cityRef.current?.focus()}
              placeholder="14 Bramley Road"
              returnKeyType="next"
              value={values.line1}
            />
            <TextField
              autoCapitalize="words"
              error={errors.city}
              label="City"
              onChangeText={(value) => setField("city", value)}
              onSubmitEditing={() => postcodeRef.current?.focus()}
              placeholder="London"
              ref={cityRef}
              returnKeyType="next"
              value={values.city}
            />
            <TextField
              autoCapitalize="characters"
              autoCorrect={false}
              error={errors.postcode}
              label="Postcode"
              onChangeText={(value) => setField("postcode", value)}
              onSubmitEditing={() => instructionsRef.current?.focus()}
              placeholder="E17 6QT"
              ref={postcodeRef}
              returnKeyType="next"
              value={values.postcode}
            />
            <TextField
              label="Delivery instructions"
              onChangeText={(value) => setField("instructions", value)}
              onSubmitEditing={handleSave}
              placeholder="Ring the top bell"
              ref={instructionsRef}
              returnKeyType="done"
              value={values.instructions}
            />
          </Animated.View>

          <Animated.View className="mt-7" entering={enter()}>
            <Image
              accessibilityIgnoresInvertColors
              alt=""
              contentFit="cover"
              source={mapPreview}
              style={{ borderRadius: 16, height: mapWidth / 3.2, width: mapWidth }}
              transition={200}
            />
          </Animated.View>

          <Animated.View className="mt-7" entering={enter()}>
            <Button label="Save address" loading={isPending} onPress={handleSave} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
