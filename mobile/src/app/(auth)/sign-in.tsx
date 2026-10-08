import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
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
import { Wordmark } from "@/components/ui/wordmark";
import { RolePicker } from "@/components/role-picker";
import { useLogin } from "@/features/auth/use-auth";
import type { AppRole } from "@/lib/api";
import { type FieldErrors, type SignInFields, validateSignIn } from "@/features/auth/validation";
import { useEnter } from "@/lib/motion";
import { landingRouteFor } from "@/features/auth/use-session";
import { toast } from "@/lib/sonner";

export default function SignInScreen() {
  const router = useRouter();
  const enter = useEnter();
  const passwordRef = useRef<TextInput>(null);
  const [foreground] = useCSSVariable(["--color-foreground"]);

  const login = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors<SignInFields>>({});
  // Most people signing in are shoppers, so that is where the picker starts.
  const [role, setRole] = useState<AppRole>("customer");

  const clearError = (field: SignInFields) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  const showSocialStub = (provider: string) => {
    Alert.alert(`${provider} sign-in is coming soon`, "Use your email and password for now.");
  };

  const handleSubmit = () => {
    if (login.isPending) return;

    const nextErrors = validateSignIn({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    login.mutate(
      { email: email.trim(), intendedRole: role, password },
      {
        onSuccess: (response) => {
          toast.success(`Welcome back, ${response.data.user.name.split(" ")[0]}`);
          router.replace(landingRouteFor(response.data.user.role, response.data.hasAddress));
        },
        onError: (error) => {
          toast.error("We could not sign you in", { description: error.message });
        },
      },
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
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

          <Animated.View className="mt-2 items-center" entering={enter()}>
            <Wordmark showCity />
          </Animated.View>

          <Animated.View className="mt-8 gap-2" entering={enter()}>
            <Text accessibilityRole="header" className="font-title text-display text-foreground">
              Welcome back
            </Text>
            <Text className="font-sans text-body text-muted-foreground">
              Sign in to shop, run your shop, or start delivering.
            </Text>
          </Animated.View>

          {/* Above the fields, not below: the choice changes where you land, and
              finding that out after typing a password is the wrong order. */}
          <Animated.View className="mt-6 gap-2" entering={enter()}>
            <Text className="font-label text-label text-text-secondary">I am signing in as</Text>
            <RolePicker onChange={setRole} value={role} />
          </Animated.View>

          <Animated.View className="mt-6 gap-4" entering={enter()}>
            <TextField
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              error={errors.email}
              inputMode="email"
              keyboardType="email-address"
              label="Email address"
              onChangeText={(value) => {
                setEmail(value);
                clearError("email");
              }}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="you@example.com"
              returnKeyType="next"
              value={email}
            />
            <TextField
              autoCapitalize="none"
              autoComplete="current-password"
              error={errors.password}
              label="Password"
              onChangeText={(value) => {
                setPassword(value);
                clearError("password");
              }}
              onSubmitEditing={handleSubmit}
              placeholder="Enter your password"
              ref={passwordRef}
              returnKeyType="go"
              secure
              value={password}
            />
          </Animated.View>

          <Animated.View className="mt-7" entering={enter()}>
            <Button label="Log in" loading={login.isPending} onPress={handleSubmit} />
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
            <Text className="font-sans text-body text-muted-foreground">New to OnlineMall? </Text>
            <Text
              accessibilityRole="link"
              className="font-heading text-body text-primary"
              onPress={() => router.replace("/sign-up")}
              suppressHighlighting
            >
              Create account
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
