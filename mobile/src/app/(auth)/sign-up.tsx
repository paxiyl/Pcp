import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { GoogleIcon } from "@/components/ui/google-icon";
import { Screen } from "@/components/ui/screen";
import { TextField } from "@/components/ui/text-field";
import { JoinAsChooser, type JoinAs } from "@/components/join-as-chooser";
import { useRegister } from "@/features/auth/use-auth";
import { useApplyToBePartner } from "@/features/partner/use-partner-application";
import {
  type FieldErrors,
  scorePassword,
  type SignUpFields,
  validateSignUp,
} from "@/features/auth/validation";
import { useEnter } from "@/lib/motion";
import { toast } from "@/lib/sonner";

const strengthTone = ["bg-border", "bg-destructive", "bg-warning", "bg-success"] as const;
const strengthLabel = ["text-muted-foreground", "text-destructive", "text-warning", "text-success"] as const;

export default function SignUpScreen() {
  const router = useRouter();
  const enter = useEnter();
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [foreground] = useCSSVariable(["--color-foreground"]);

  const register = useRegister();
  const apply = useApplyToBePartner();

  const [joinAs, setJoinAs] = useState<JoinAs>("customer");
  const [businessName, setBusinessName] = useState("");
  const [businessError, setBusinessError] = useState<string | undefined>();
  const needsBusinessName = joinAs === "store_owner" || joinAs === "restaurant_owner";

  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors<SignUpFields>>({});

  const strength = useMemo(() => scorePassword(values.password), [values.password]);

  const setField = (field: SignUpFields, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const showSocialStub = (provider: string) => {
    Alert.alert(`${provider} sign-up is coming soon`, "Create your account with email for now.");
  };

  const handleSubmit = () => {
    if (register.isPending) return;

    const nextErrors = validateSignUp(values);
    setErrors(nextErrors);

    if (needsBusinessName && businessName.trim().length < 2) {
      setBusinessError(
        joinAs === "store_owner" ? "Enter your shop's name" : "Enter your kitchen's name",
      );

      return;
    }

    if (Object.keys(nextErrors).length > 0) return;

    register.mutate(
      {
        email: values.email.trim(),
        name: values.name.trim(),
        password: values.password,
        phone: values.phone.trim() || undefined,
      },
      {
        onSuccess: (response) => {
          const firstName = response.data.user.name.split(" ")[0];

          if (joinAs === "customer") {
            toast.success(`Welcome to OnlineMall, ${firstName}`);
            router.replace(response.data.hasAddress ? "/home" : "/location");

            return;
          }

          // The account exists either way. Filing the request is a second step,
          // and failing it must not strand someone with no way in — so they are
          // let through as a customer and told to try again from their profile.
          apply.mutate(
            {
              businessName: needsBusinessName ? businessName.trim() : undefined,
              phone: values.phone.trim(),
              requestedRole: joinAs,
            },
            {
              onError: () =>
                toast.error("Your account is ready, but we could not send your request", {
                  description: "You can apply again from your profile.",
                }),
              onSettled: () => router.replace(response.data.hasAddress ? "/home" : "/location"),
              onSuccess: () =>
                toast.success("Request sent", {
                  description: "We review these by hand and will be in touch.",
                }),
            },
          );
        },
        onError: (error) => {
          toast.error("We could not create your account", { description: error.message });
        },
      },
    );
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
              Create your account
            </Text>
            <Text className="font-sans text-body text-muted-foreground">
              One account for ordering, tracking and saved addresses.
            </Text>
          </Animated.View>

          <Animated.View className="mt-7 gap-4" entering={enter()}>
            <JoinAsChooser onChange={setJoinAs} value={joinAs} />

            {needsBusinessName ? (
              <TextField
                autoCapitalize="words"
                error={businessError}
                label={joinAs === "store_owner" ? "Shop name" : "Kitchen name"}
                onChangeText={(value) => {
                  setBusinessName(value);
                  setBusinessError(undefined);
                }}
                placeholder={
                  joinAs === "store_owner" ? "Sharma General Store" : "Sharma Bhojnalaya"
                }
                value={businessName}
              />
            ) : null}

            <TextField
              autoCapitalize="words"
              autoComplete="name"
              error={errors.name}
              label="Full name"
              onChangeText={(value) => setField("name", value)}
              onSubmitEditing={() => emailRef.current?.focus()}
              placeholder="Amaka Obi"
              returnKeyType="next"
              value={values.name}
            />
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              error={errors.email}
              inputMode="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => setField("email", value)}
              onSubmitEditing={() => phoneRef.current?.focus()}
              placeholder="you@example.com"
              ref={emailRef}
              returnKeyType="next"
              value={values.email}
            />
            <TextField
              autoComplete="tel"
              error={errors.phone}
              inputMode="tel"
              keyboardType="phone-pad"
              label="Phone"
              onChangeText={(value) => setField("phone", value)}
              placeholder="+44 7700 900412"
              ref={phoneRef}
              returnKeyType="next"
              value={values.phone}
            />
            <View className="gap-2">
              <TextField
                autoCapitalize="none"
                autoComplete="new-password"
                error={errors.password}
                label="Password"
                onChangeText={(value) => setField("password", value)}
                onSubmitEditing={handleSubmit}
                placeholder="At least 8 characters"
                ref={passwordRef}
                returnKeyType="go"
                secure
                value={values.password}
              />
              {strength.label ? (
                <View className="gap-2">
                  <View className="flex-row gap-2">
                    {[1, 2, 3].map((bar) => (
                      <View
                        className={`h-1 flex-1 rounded-pill ${
                          strength.score >= bar ? strengthTone[strength.score] : "bg-border"
                        }`}
                        key={bar}
                      />
                    ))}
                  </View>
                  <Text
                    accessibilityLiveRegion="polite"
                    className={`font-label text-label ${strengthLabel[strength.score]}`}
                  >
                    {strength.label}
                  </Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View className="mt-7" entering={enter()}>
            <Button label="Create account" loading={register.isPending} onPress={handleSubmit} />
          </Animated.View>

          <Animated.View className="my-7 flex-row items-center gap-4" entering={enter()}>
            <View className="h-px flex-1 bg-border" />
            <Text className="font-sans text-body text-muted-foreground">or</Text>
            <View className="h-px flex-1 bg-border" />
          </Animated.View>

          <Animated.View className="gap-3" entering={enter()}>
            <Button
              icon={<GoogleIcon />}
              label="Continue with Google"
              onPress={() => showSocialStub("Google")}
              variant="outline"
            />
            <Button
              icon={<Ionicons color={foreground as string} name="logo-apple" size={20} />}
              label="Continue with Apple"
              onPress={() => showSocialStub("Apple")}
              variant="outline"
            />
          </Animated.View>

          <View className="mt-auto flex-row items-center justify-center pt-8">
            <Text className="font-sans text-body text-muted-foreground">
              Already have an account?{" "}
            </Text>
            <Text
              accessibilityRole="link"
              className="font-heading text-body text-primary"
              onPress={() => router.replace("/sign-in")}
              suppressHighlighting
            >
              Log in
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
