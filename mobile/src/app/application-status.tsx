import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { JoinAsChooser, type JoinAs } from "@/components/join-as-chooser";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { useCurrentUser } from "@/features/auth/use-auth";
import {
  useApplyToBePartner,
  useMyApplication,
} from "@/features/partner/use-partner-application";
import type { PartnerRole } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { toast } from "@/lib/sonner";

const ROLE_LABEL: Record<PartnerRole, string> = {
  driver: "a delivery partner",
  restaurant_owner: "a kitchen",
  store_owner: "a shop",
};

const ROLE_ICON: Record<PartnerRole, keyof typeof Ionicons.glyphMap> = {
  driver: "bicycle",
  restaurant_owner: "restaurant",
  store_owner: "storefront",
};

/**
 * Where a partner application actually stands.
 *
 * Signing up as a kitchen used to say "Welcome to Raket" and drop you on the
 * customer home — which looks exactly like the app ignoring what you picked,
 * and was the single most confusing thing about joining. The account IS a
 * customer until an admin approves, and that is correct; what was missing was
 * anything on screen admitting it.
 *
 * Reachable again from the profile, so checking back does not mean signing up
 * twice.
 */
export default function ApplicationStatusScreen() {
  const router = useRouter();
  const [primary, warning, success, error, subtle] = useCSSVariable([
    "--color-primary",
    "--color-warning",
    "--color-success",
    "--color-error",
    "--color-subtle-foreground",
  ]);

  const { data: application, isLoading, refetch, isRefetching } = useMyApplication();
  const { data: user } = useCurrentUser();
  const apply = useApplyToBePartner();

  /*
    The apply form, shown only when there is nothing to report.

    An existing customer who decides to open a kitchen should not have to make
    a second account with a second email to ask — which was the only route
    before, because the one place this could be asked was the sign-up form.
  */
  const [wantsToBe, setWantsToBe] = useState<JoinAs>("store_owner");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [formError, setFormError] = useState<string | undefined>();

  const needsName = wantsToBe === "store_owner" || wantsToBe === "restaurant_owner";

  const submit = () => {
    if (apply.isPending || wantsToBe === "customer") return;

    if (needsName && businessName.trim().length < 2) {
      setFormError(
        wantsToBe === "store_owner" ? "Enter your shop's name" : "Enter your kitchen's name",
      );

      return;
    }

    if (phone.trim().length < 7) {
      setFormError("We need a number to call you on");

      return;
    }

    setFormError(undefined);

    apply.mutate(
      {
        businessName: needsName ? businessName.trim() : undefined,
        phone: phone.trim(),
        requestedRole: wantsToBe,
      },
      {
        onError: (error) =>
          toast.error("We could not send that", { description: error.message }),
        onSuccess: () => {
          toast.success("Request sent", {
            description: "We review these by hand and will be in touch.",
          });
          void refetch();
        },
      },
    );
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/home"));

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={primary as string} />
        </View>
      </Screen>
    );
  }

  const role = application?.requestedRole;
  const status = application?.status;

  const tone =
    status === "approved"
      ? (success as string)
      : status === "rejected"
        ? (error as string)
        : (warning as string);

  const headline =
    !application
      ? "Join Raket"
      : status === "pending"
        ? "We have your application"
        : status === "approved"
          ? "You are approved"
          : "Not approved this time";

  const body =
    !application
      ? "Run a shop or a kitchen in Hindaun, or want to deliver? Tell us which and we will call you back."
      : status === "pending"
        ? `You asked to join ${BRAND.fullName} as ${ROLE_LABEL[role as PartnerRole]}. Someone is reviewing it — we will ring the number you gave us. Until then your account works as an ordinary customer account, so you can still shop.`
        : status === "approved"
          ? `Your account is now ${ROLE_LABEL[role as PartnerRole]}. Sign out and sign back in, choosing ${role === "driver" ? "Delivery partner" : role === "store_owner" ? "Store owner" : "Kitchen owner"}, and your own screens will open.`
          : application.reviewNote
            ? `We could not approve this one. ${application.reviewNote}`
            : "We could not approve this one. Ring us if you think that is a mistake, and we can look again.";

  return (
    <Screen>
      <View className="flex-row items-center px-gutter py-3">
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="-ml-2 h-11 w-11 items-center justify-center"
          hitSlop={8}
          onPress={close}
        >
          <Ionicons color={subtle as string} name="arrow-back" size={24} />
        </Pressable>
        <View className="flex-1" />
        <Pressable
          accessibilityLabel="Check again"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center"
          hitSlop={8}
          onPress={() => void refetch()}
        >
          {isRefetching ? (
            <ActivityIndicator color={subtle as string} size="small" />
          ) : (
            <Ionicons color={subtle as string} name="refresh" size={22} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerClassName="grow items-center justify-center px-gutter pb-10"
        showsVerticalScrollIndicator={false}
      >
        <View
          className="items-center justify-center rounded-pill"
          style={{ backgroundColor: `${tone}1A`, height: 84, width: 84 }}
        >
          <Ionicons
            color={tone}
            name={role ? ROLE_ICON[role] : "help-circle-outline"}
            size={38}
          />
        </View>

        <Text
          accessibilityRole="header"
          className="mt-6 text-center font-title text-title text-foreground"
        >
          {headline}
        </Text>

        <Text className="mt-3 max-w-sm text-center font-sans text-body text-text-secondary">
          {body}
        </Text>

        {application?.businessName ? (
          <View className="mt-6 w-full rounded-card bg-surface p-4">
            <Text className="font-sans text-caption text-text-muted">Applied as</Text>
            <Text className="font-heading text-body text-foreground">
              {application.businessName}
            </Text>
            <Text className="mt-2 font-sans text-caption text-text-muted">We will call</Text>
            <Text className="font-label text-body text-foreground">{application.phone}</Text>
          </View>
        ) : null}

        {/* No application: offer to make one, rather than telling them to go
            and find an option that did not exist. */}
        {!application ? (
          <View className="mt-7 w-full gap-4">
            <JoinAsChooser onChange={setWantsToBe} value={wantsToBe} />

            {needsName ? (
              <TextField
                autoCapitalize="words"
                error={formError && needsName ? formError : undefined}
                label={wantsToBe === "store_owner" ? "Shop name" : "Kitchen name"}
                onChangeText={(value) => {
                  setBusinessName(value);
                  setFormError(undefined);
                }}
                placeholder={
                  wantsToBe === "store_owner" ? "Sharma Kirana" : "Hindaun Tandoori"
                }
                value={businessName}
              />
            ) : null}

            <TextField
              keyboardType="phone-pad"
              label="Phone number"
              onChangeText={(value) => {
                setPhone(value);
                setFormError(undefined);
              }}
              placeholder="98765 43210"
              value={phone}
            />

            {formError && !needsName ? (
              <Text className="font-sans text-caption text-destructive">{formError}</Text>
            ) : null}

            <Button
              label={
                wantsToBe === "driver"
                  ? "Apply to deliver"
                  : wantsToBe === "store_owner"
                    ? "Apply as a shop"
                    : "Apply as a kitchen"
              }
              loading={apply.isPending}
              onPress={submit}
            />
            <Button
              label="Not now"
              onPress={() => router.replace("/home")}
              variant="outline"
            />
          </View>
        ) : (
          <View className="mt-7 w-full gap-3">
            {status === "pending" ? (
              <Button label="Check again" loading={isRefetching} onPress={() => void refetch()} />
            ) : null}
            <Button
              label="Start shopping"
              onPress={() => router.replace("/home")}
              variant={status === "pending" ? "outline" : "primary"}
            />
          </View>
        )}

        <Text className="mt-6 text-center font-sans text-caption text-text-muted">
          Questions? {BRAND.supportEmail}
        </Text>
      </ScrollView>
    </Screen>
  );
}
