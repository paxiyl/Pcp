import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Linking, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { useDefaultAddress } from "@/features/location/use-addresses";
import { useDeliveryLocation } from "@/features/location/use-delivery-location";
import { useEnter } from "@/lib/motion";

const locationArt = require("@/assets/images/app-imgs/location-img.png");

export default function LocationScreen() {
  const router = useRouter();
  const enter = useEnter();
  const { data: saved } = useDefaultAddress();
  const { requestLocation, status } = useDeliveryLocation();
  const [subtle, primary] = useCSSVariable(["--color-subtle-foreground", "--color-primary"]);

  const handleUseLocation = async () => {
    const resolved = await requestLocation();

    if (resolved) {
      router.push({
        pathname: "/address",
        params: {
          city: resolved.city,
          latitude: String(resolved.latitude),
          line1: resolved.line1,
          longitude: String(resolved.longitude),
          postcode: resolved.postcode,
        },
      });
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="grow justify-center px-5 py-8"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View className="items-center" entering={enter()}>
          <Image
            accessibilityIgnoresInvertColors
            alt="A delivery route running from a restaurant to a map pin beside a takeaway bag"
            contentFit="contain"
            source={locationArt}
            style={{ height: 260, width: 260 }}
            transition={250}
          />
        </Animated.View>

        <Animated.View className="mt-7 gap-3" entering={enter()}>
          <Text
            accessibilityRole="header"
            className="text-center font-title text-display text-foreground"
          >
            Good food, right{"\n"}where you are
          </Text>
          <Text className="text-center font-sans text-body text-muted-foreground">
            Share your location so we can show restaurants and delivery times near you.
          </Text>
        </Animated.View>

        {saved ? (
          <Animated.View
            className="mt-7 gap-1 rounded-card border border-border bg-card p-5"
            entering={enter()}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons color={primary as string} name="location" size={18} />
              <Text className="font-heading text-section text-card-foreground">
                Delivering to {saved.label}
              </Text>
            </View>
            <Text className="font-sans text-body text-card-foreground">{saved.line1}</Text>
            <Text className="font-label text-label text-muted-foreground">
              {[saved.city, saved.postcode].filter(Boolean).join(" · ")}
            </Text>
          </Animated.View>
        ) : null}

        {status === "denied" ? (
          <Animated.View
            className="mt-7 flex-row items-start gap-3 rounded-card border border-border bg-muted p-4"
            entering={enter()}
          >
            <Ionicons color={subtle as string} name="information-circle-outline" size={20} />
            <View className="flex-1 gap-2">
              <Text className="font-sans text-body text-foreground">
                Location is turned off for OnlineMall. You can enter your address by hand instead, or
                turn it on in Settings.
              </Text>
              <Text
                accessibilityRole="link"
                className="font-heading text-body text-primary"
                onPress={() => void Linking.openSettings()}
                suppressHighlighting
              >
                Open Settings
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {status === "error" ? (
          <Animated.View
            className="mt-7 rounded-card border border-destructive/40 bg-muted p-4"
            entering={enter()}
          >
            <Text className="font-sans text-body text-foreground">
              We couldn't work out where you are. Try again, or enter your address by hand.
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View className="mt-9 gap-3" entering={enter()}>
          {saved ? (
            <>
              <Button label="Continue" onPress={() => router.replace("/home")} />
              <Button
                label="Edit address"
                onPress={() => router.push("/address")}
                variant="outline"
              />
            </>
          ) : (
            <>
              <Button
                label="Use my location"
                loading={status === "requesting"}
                onPress={handleUseLocation}
              />
              <Button
                label="Enter address manually"
                onPress={() => router.push("/address")}
                variant="link"
              />
            </>
          )}
        </Animated.View>

        <Animated.View
          className="mt-7 flex-row items-center justify-center gap-2"
          entering={enter()}
        >
          <Ionicons color={subtle as string} name="shield-checkmark-outline" size={18} />
          <Text className="font-label text-label text-subtle-foreground">
            Your location is only used for delivery.
          </Text>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}
