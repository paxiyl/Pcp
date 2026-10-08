import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";

import { Button } from "@/components/ui/button";
import { useAddresses, useSetDefaultAddress } from "@/features/location/use-addresses";
import type { Address } from "@/lib/api";
import { toast } from "@/lib/sonner";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ICONS = {
  Home: "home-outline",
  Work: "briefcase-outline",
  Other: "location-outline",
} as const;

/**
 * The delivery address picker behind the home header. Tapping a row switches
 * where the order goes; the pencil opens that address for editing, so the two
 * actions never fight over the same tap.
 */
export function AddressSheet({ open, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: addresses, isLoading } = useAddresses();
  const setDefault = useSetDefaultAddress();
  const [primary, muted, foreground] = useCSSVariable([
    "--color-primary",
    "--color-muted-foreground",
    "--color-foreground",
  ]);

  const choose = (address: Address) => {
    if (address.isDefault) {
      onClose();

      return;
    }

    setDefault.mutate(address._id, {
      onError: (error) =>
        toast.error("We could not switch your address", { description: error.message }),
      onSuccess: () => {
        toast.success("Delivering to " + address.line1);
        onClose();
      },
    });
  };

  const edit = (address: Address) => {
    onClose();
    router.push({ params: { id: address._id }, pathname: "/address" });
  };

  const addNew = () => {
    onClose();
    router.push({ params: { mode: "new" }, pathname: "/address" });
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      {/* Tapping the scrim closes, matching every other sheet in the app. */}
      <Pressable
        accessibilityLabel="Close"
        className="flex-1 justify-end"
        onPress={onClose}
        style={{ backgroundColor: "rgba(16,42,42,0.45)" }}
      >
        <Pressable
          className="max-h-[80%] gap-4 rounded-t-sheet bg-card px-5 pt-6"
          onPress={(event) => event.stopPropagation()}
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text accessibilityRole="header" className="font-title text-title text-foreground">
              Deliver to
            </Text>
            <Pressable
              accessibilityLabel="Close"
              accessibilityRole="button"
              className="h-9 w-9 items-center justify-center active:opacity-70"
              hitSlop={8}
              onPress={onClose}
            >
              <Ionicons color={muted as string} name="close" size={22} />
            </Pressable>
          </View>

          {isLoading ? (
            <View className="py-10">
              <ActivityIndicator color={primary as string} />
            </View>
          ) : addresses?.length ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-3">
                {addresses.map((address) => (
                  <View
                    className={`flex-row items-center gap-3 rounded-card border px-4 py-3 ${
                      address.isDefault ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                    key={address._id}
                  >
                    <Pressable
                      accessibilityHint="Delivers your next order here"
                      accessibilityLabel={`${address.label}, ${address.line1}`}
                      accessibilityRole="button"
                      className="flex-1 flex-row items-center gap-3 active:opacity-70"
                      disabled={setDefault.isPending}
                      onPress={() => choose(address)}
                    >
                      <View className="h-10 w-10 items-center justify-center rounded-pill bg-secondary">
                        <Ionicons
                          color={primary as string}
                          name={ICONS[address.label]}
                          size={20}
                        />
                      </View>

                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-heading text-body text-card-foreground">
                            {address.label}
                          </Text>
                          {address.isDefault ? (
                            <Text className="font-label text-caption text-primary">Current</Text>
                          ) : null}
                        </View>
                        <Text
                          className="font-sans text-label text-muted-foreground"
                          numberOfLines={1}
                        >
                          {address.line1}, {address.city} {address.postcode}
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      accessibilityLabel={`Edit ${address.label} address`}
                      accessibilityRole="button"
                      className="h-10 w-10 items-center justify-center rounded-pill active:bg-muted"
                      hitSlop={6}
                      onPress={() => edit(address)}
                    >
                      <Ionicons color={foreground as string} name="pencil" size={18} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <Text className="font-sans text-body text-muted-foreground">
              No saved addresses yet. Add one to start ordering.
            </Text>
          )}

          <Button
            icon={<Ionicons color="white" name="add" size={20} />}
            label="Add a new address"
            onPress={addNew}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
