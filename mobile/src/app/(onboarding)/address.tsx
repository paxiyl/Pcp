import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  type TextInput,
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
import { useDeliveryLocation } from "@/features/location/use-delivery-location";
import type { AddressLabel } from "@/lib/api";
import { useEnter } from "@/lib/motion";
import { toast } from "@/lib/sonner";

const LABELS = ["Home", "Work", "Other"] as const;

type Field = "line1" | "city" | "postcode";

type Pin = { latitude: number; longitude: number };

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
  const [foreground, primary, success, subtle] = useCSSVariable([
    "--color-foreground",
    "--color-primary",
    "--color-success",
    "--color-subtle-foreground",
  ]);
  const { requestLocation, status: locating } = useDeliveryLocation();

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

  /**
   * The coordinates, held separately from the text fields because they are not
   * derived from them. Without a pin the rider's navigation has to geocode a
   * handwritten Hindaun address, which often lands on the wrong lane.
   */
  const [pin, setPin] = useState<Pin | null>(
    params.latitude && params.longitude
      ? { latitude: Number(params.latitude), longitude: Number(params.longitude) }
      : null,
  );

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

    // GeoJSON order is [longitude, latitude].
    const coordinates = saved.location?.coordinates;

    setPin((current) =>
      current ?? (coordinates ? { latitude: coordinates[1], longitude: coordinates[0] } : null),
    );
  }, [params.city, params.line1, params.postcode, saved]);

  const setField = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      field in current ? { ...current, [field as Field]: undefined } : current,
    );
  };

  /**
   * Fills the form from GPS and keeps the coordinates. Anything the reverse
   * geocode could not name is left for the customer rather than overwritten
   * with a blank — a half-resolved address is still worth having a pin for.
   */
  const usePin = async () => {
    const resolved = await requestLocation();

    if (!resolved) {
      toast.error("We could not get your location", {
        description:
          locating === "denied"
            ? "Allow location access for Raket in your phone settings, or type the address below."
            : "Check that location is switched on, or type the address below.",
      });

      return;
    }

    setPin({ latitude: resolved.latitude, longitude: resolved.longitude });
    setValues((current) => ({
      ...current,
      city: resolved.city || current.city,
      line1: resolved.line1 || current.line1,
      postcode: resolved.postcode || current.postcode,
    }));
    setErrors({});
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
      latitude: pin?.latitude,
      line1: values.line1.trim(),
      longitude: pin?.longitude,
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
              placeholder="House 24, Bazaar Road"
              returnKeyType="next"
              value={values.line1}
            />
            <TextField
              autoCapitalize="words"
              error={errors.city}
              label="City"
              onChangeText={(value) => setField("city", value)}
              onSubmitEditing={() => postcodeRef.current?.focus()}
              placeholder="Hindaun City"
              ref={cityRef}
              returnKeyType="next"
              value={values.city}
            />
            <TextField
              autoCorrect={false}
              error={errors.postcode}
              label="Postcode"
              onChangeText={(value) => setField("postcode", value)}
              keyboardType="number-pad"
              maxLength={6}
              onSubmitEditing={() => instructionsRef.current?.focus()}
              placeholder="322230"
              ref={postcodeRef}
              returnKeyType="next"
              value={values.postcode}
            />
            <TextField
              label="Delivery instructions"
              onChangeText={(value) => setField("instructions", value)}
              onSubmitEditing={handleSave}
              placeholder="Blue gate, ring the bell"
              ref={instructionsRef}
              returnKeyType="done"
              value={values.instructions}
            />
          </Animated.View>

          {/*
            A real pin, not a picture of one. This used to be a decorative map
            PNG, which told the customer nothing and gave the rider nothing.
          */}
          <Animated.View className="mt-7" entering={enter()}>
            <Pressable
              accessibilityLabel={pin ? "Update the pinned location" : "Pin my current location"}
              accessibilityRole="button"
              accessibilityState={{ busy: locating === "requesting" }}
              className="flex-row items-center gap-3 rounded-card border border-border bg-card p-4 active:bg-muted"
              disabled={locating === "requesting"}
              onPress={usePin}
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-pill"
                style={{ backgroundColor: pin ? (success as string) : (primary as string) }}
              >
                {locating === "requesting" ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Ionicons color="#ffffff" name={pin ? "checkmark" : "locate"} size={20} />
                )}
              </View>

              <View className="flex-1">
                <Text className="font-heading text-body text-foreground">
                  {pin ? "Location pinned" : "Pin my location"}
                </Text>
                <Text className="font-sans text-label text-muted-foreground">
                  {pin
                    ? `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)} — your rider navigates straight here.`
                    : "Lets your rider navigate to the exact spot instead of guessing from the address."}
                </Text>
              </View>

              <Ionicons color={subtle as string} name="chevron-forward" size={18} />
            </Pressable>
          </Animated.View>

          <Animated.View className="mt-7" entering={enter()}>
            <Button label="Save address" loading={isPending} onPress={handleSave} />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
