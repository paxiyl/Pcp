import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import {
  useClaimDelivery,
  useCompleteDelivery,
  useDelivery,
  usePickUpDelivery,
} from "@/features/driver/use-driver";
import type { OrderPoint } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { distanceKm, formatAddress, formatDistance, openDirections } from "@/lib/navigation";
import { toast } from "@/lib/sonner";

const CODE_LENGTH = 4;

/**
 * One leg of the run. The arrow is the whole point of the card for a rider on a
 * bike: it hands the stop straight to the Maps app for turn-by-turn, rather than
 * making them copy an address across by hand at the kerb.
 */
const Stop = ({
  address,
  distance,
  icon,
  label,
  point,
  title,
}: {
  address: string;
  distance?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Preferred over the written address, which may not geocode. */
  point?: OrderPoint;
  title: string;
}) => {
  const [primary] = useCSSVariable(["--color-primary"]);

  const navigate = async () => {
    const opened = await openDirections(point, address || title);

    if (!opened) {
      toast.error("Nothing to navigate to", {
        description: `This order has no ${label.toLowerCase()} location saved.`,
      });
    }
  };

  return (
    <View className="mx-5 mb-3 flex-row items-center gap-4 rounded-card border border-border bg-card p-4">
      <View className="h-12 w-12 items-center justify-center rounded-pill border border-primary">
        <Ionicons color={primary as string} name={icon} size={22} />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="font-heading text-label text-primary">{label}</Text>
          {distance ? (
            <Text className="font-sans text-label text-muted-foreground">· {distance}</Text>
          ) : null}
        </View>
        <Text className="font-heading text-section text-foreground">{title}</Text>
        {address ? (
          <Text className="font-sans text-body text-muted-foreground">{address}</Text>
        ) : null}
      </View>

      <Pressable
        accessibilityLabel={`Navigate to the ${label.toLowerCase()}`}
        accessibilityRole="button"
        className="h-12 w-12 items-center justify-center rounded-pill bg-primary active:opacity-90"
        hitSlop={6}
        onPress={navigate}
      >
        <Ionicons color="#ffffff" name="navigate" size={20} />
      </Pressable>
    </View>
  );
};

/**
 * One job, end to end: what to collect, where it goes, what it pays, and the
 * single action available at this point in the run. Each step has its own
 * colour, so a rider glancing at the screen can tell them apart at speed.
 */
export default function DeliveryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [primary, subtle, warning, success, muted, border, foreground] = useCSSVariable([
    "--color-primary",
    "--color-subtle-foreground",
    "--color-warning",
    "--color-success",
    "--color-muted-foreground",
    "--color-border",
    "--color-foreground",
  ]);

  const { data, isLoading } = useDelivery(id ?? "");
  const claim = useClaimDelivery();
  const pickUp = usePickUpDelivery();
  const complete = useCompleteDelivery();

  const [itemsOpen, setItemsOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");

  const close = () => (router.canGoBack() ? router.back() : router.replace("/driver-home"));

  const header = (
    <View className="flex-row items-center px-5 py-3">
      <Pressable
        accessibilityLabel="Back"
        accessibilityRole="button"
        className="-ml-2 h-11 w-11 items-center justify-center"
        hitSlop={8}
        onPress={close}
      >
        <Ionicons color={foreground as string} name="arrow-back" size={24} />
      </Pressable>
      <Text
        accessibilityRole="header"
        className="flex-1 text-center font-title text-title text-foreground"
      >
        Delivery detail
      </Text>
      <View className="h-11 w-11" />
    </View>
  );

  if (isLoading || !data) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {header}
        <View className="mx-5 gap-3">
          {[0, 1].map((key) => (
            <View
              className="flex-row items-center gap-4 rounded-card border border-border bg-card p-4"
              key={key}
            >
              <View className="h-12 w-12 rounded-pill bg-muted" />
              <View className="flex-1 gap-2">
                <View className="h-3 w-16 rounded-input bg-muted" />
                <View className="h-5 w-44 rounded-input bg-muted" />
                <View className="h-3 w-32 rounded-input bg-muted" />
              </View>
            </View>
          ))}
          <View className="h-40 rounded-card border border-border bg-card" />
        </View>
      </View>
    );
  }

  const { order, payout } = data;
  const itemCount = order.items.reduce((count, item) => count + item.quantity, 0);
  // Stating "already paid" is as important as stating the amount: a rider who is
  // never told either way has to guess, and guessing wrong costs them the money.
  const cashToCollect = order.paymentMethod === "cod" && !order.codCollectedAt;

  const dropOff = formatAddress(order.deliveryAddress);
  // How far the rider still has to ride, once they are carrying the order.
  const legToDropOff =
    order.restaurantLocation && order.deliveryLocation
      ? formatDistance(distanceKm(order.restaurantLocation, order.deliveryLocation))
      : undefined;

  const busy = claim.isPending || pickUp.isPending || complete.isPending;
  const onError = (error: Error) =>
    toast.error("That did not go through", { description: error.message });

  const submitCode = () => {
    if (code.length !== CODE_LENGTH || complete.isPending) return;

    complete.mutate(
      { code, id: order._id },
      {
        onError: (error) => {
          setCode("");
          onError(error);
        },
        onSuccess: () => {
          setCodeOpen(false);
          setCode("");
          toast("Delivery complete", {
            description: `${formatPrice(payout.total)} added to today's earnings.`,
          });
          close();
        },
      },
    );
  };

  // One action at a time: claim it, collect it, then hand it over. Teal to claim,
  // amber while it is in hand, green to close the run.
  const action = !order.driver
    ? {
        color: primary as string,
        label: "Claim delivery",
        run: () => claim.mutate(order._id, { onError }),
      }
    : order.status === "ready"
      ? {
          color: warning as string,
          label: "Mark as picked up",
          run: () => pickUp.mutate(order._id, { onError }),
        }
      : order.status === "out_for_delivery"
        ? {
            color: success as string,
            label: "Mark as delivered",
            run: () => setCodeOpen(true),
          }
        : null;

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {header}

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Stop
          address={order.restaurantAddress ?? ""}
          icon="storefront-outline"
          label="Pickup"
          point={order.restaurantLocation}
          title={order.restaurantName}
        />

        <Stop
          address={order.deliveryAddress.instructions ?? ""}
          distance={legToDropOff}
          icon="location-outline"
          label="Drop-off"
          point={order.deliveryLocation}
          title={dropOff}
        />

        <View className="mx-5 overflow-hidden rounded-card border border-border bg-card">
          {/* The rider checks the bag against this before leaving the kitchen. */}
          <Pressable
            accessibilityLabel={`${itemCount} items, ${itemsOpen ? "hide" : "show"} the list`}
            accessibilityRole="button"
            accessibilityState={{ expanded: itemsOpen }}
            className="flex-row items-center gap-3 p-4 active:bg-muted"
            onPress={() => setItemsOpen((current) => !current)}
          >
            <Ionicons color={primary as string} name="cube-outline" size={22} />
            <Text className="flex-1 font-heading text-body text-foreground">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Text>
            <Ionicons
              color={subtle as string}
              name={itemsOpen ? "chevron-up" : "chevron-down"}
              size={18}
            />
          </Pressable>

          {itemsOpen ? (
            <View className="border-t border-border">
              {order.items.map((item, index) => (
                <View
                  className={`flex-row items-start gap-3 px-4 py-3 ${
                    index > 0 ? "border-t border-border" : ""
                  }`}
                  key={item._id}
                >
                  <Text className="w-7 font-heading text-body text-primary">×{item.quantity}</Text>

                  <View className="flex-1">
                    <Text className="font-heading text-body text-foreground">{item.name}</Text>
                    {item.optionNames.length > 0 ? (
                      <Text className="font-sans text-label text-muted-foreground">
                        {item.optionNames.join(", ")}
                      </Text>
                    ) : null}
                    {item.note ? (
                      <Text className="font-sans text-caption text-muted-foreground">
                        Note: {item.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}

              {order.includeCutlery ? (
                <View className="flex-row items-center gap-3 border-t border-border px-4 py-3">
                  <Ionicons color={subtle as string} name="restaurant-outline" size={16} />
                  <Text className="font-sans text-body text-muted-foreground">
                    Cutlery requested
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View className="gap-2 border-t border-border p-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted-foreground">Base</Text>
              <Text className="font-sans text-body text-foreground">
                {formatPrice(payout.base)}
              </Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="font-sans text-body text-muted-foreground">
                Distance{payout.distanceKm > 0 ? ` · ${payout.distanceKm.toFixed(1)} km` : ""}
              </Text>
              <Text className="font-sans text-body text-foreground">
                {formatPrice(payout.distance)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between border-t border-border p-4">
            <Text className="font-heading text-section text-foreground">Total</Text>
            <Text className="font-title text-title text-foreground">
              {formatPrice(payout.total)}
            </Text>
          </View>
        </View>

        {cashToCollect ? (
          <View className="mx-5 mt-3 flex-row items-center gap-3 rounded-card bg-warning-soft p-4">
            <Ionicons color={warning as string} name="cash-outline" size={24} />
            <View className="flex-1">
              <Text className="font-title text-section text-warning">
                Collect {formatPrice(order.codAmountDue ?? order.total)} in cash
              </Text>
              <Text className="font-sans text-label text-text-secondary">
                This is a cash order. Take the money before you confirm the code.
              </Text>
            </View>
          </View>
        ) : (
          <View className="mx-5 mt-3 flex-row items-center gap-3 rounded-card bg-success-soft p-4">
            <Ionicons color={success as string} name="checkmark-circle-outline" size={22} />
            <Text className="flex-1 font-label text-body text-foreground">
              Already paid online — collect nothing at the door.
            </Text>
          </View>
        )}

        {order.status === "out_for_delivery" ? (
          <View className="mx-5 mt-3 flex-row gap-3 rounded-card bg-muted p-4">
            <Ionicons color={subtle as string} name="shield-checkmark-outline" size={20} />
            <Text className="flex-1 font-sans text-body text-foreground">
              Ask the customer for their 4-digit confirmation code when you hand the order over.
            </Text>
          </View>
        ) : null}

        {order.orderNote ? (
          <View className="mx-5 mt-3 flex-row gap-3 rounded-card bg-muted p-4">
            <Ionicons color={subtle as string} name="document-text-outline" size={20} />
            <Text className="flex-1 font-sans text-body text-foreground">{order.orderNote}</Text>
          </View>
        ) : null}
      </ScrollView>

      {action ? (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            className="h-14 items-center justify-center rounded-input active:opacity-90"
            disabled={busy}
            onPress={action.run}
            style={{ backgroundColor: action.color }}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-heading text-body text-white">{action.label}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Handover: the code proves the order reached the right person. */}
      <Modal
        animationType="slide"
        onRequestClose={() => setCodeOpen(false)}
        transparent
        visible={codeOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1 justify-end"
          style={{ backgroundColor: "rgba(16,42,42,0.45)" }}
        >
          <View
            className="gap-4 rounded-t-sheet bg-card px-5 pt-6"
            style={{ paddingBottom: insets.bottom + 20 }}
          >
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text accessibilityRole="header" className="font-title text-title text-foreground">
                  {cashToCollect
                    ? `Collect ${formatPrice(order.codAmountDue ?? order.total)}, then enter the code`
                    : "Confirmation code"}
                </Text>
                <Text className="mt-1 font-sans text-body text-muted-foreground">
                  Ask {order.contactName.split(" ")[0]} for the 4 digits shown in their app.
                </Text>
              </View>

              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                className="-mr-2 h-11 w-11 items-center justify-center"
                hitSlop={8}
                onPress={() => setCodeOpen(false)}
              >
                <Ionicons color={subtle as string} name="close" size={24} />
              </Pressable>
            </View>

            {/* One field behind four boxes: native keyboard, custom presentation. */}
            <Pressable className="flex-row justify-center gap-3 py-2">
              <TextInput
                accessibilityLabel="Confirmation code"
                autoFocus
                caretHidden
                className="absolute h-full w-full opacity-0"
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                returnKeyType="done"
                value={code}
              />

              {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                <View
                  className="h-16 w-14 items-center justify-center rounded-input border-2 bg-card"
                  key={index}
                  style={{
                    borderColor:
                      index === code.length ? (success as string) : (border as string),
                  }}
                >
                  <Text className="font-title text-title text-foreground">
                    {code[index] ?? ""}
                  </Text>
                </View>
              ))}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: code.length !== CODE_LENGTH || complete.isPending }}
              className="h-14 items-center justify-center rounded-input active:opacity-90"
              disabled={code.length !== CODE_LENGTH || complete.isPending}
              onPress={submitCode}
              style={{
                backgroundColor:
                  code.length === CODE_LENGTH ? (success as string) : (muted as string),
              }}
            >
              {complete.isPending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-heading text-body text-white">Confirm delivery</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
