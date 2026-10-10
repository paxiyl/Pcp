import { useRouter } from "expo-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { signInWithGoogle } from "@/features/auth/google-sign-in";
import { useGoogleAvailable, useGoogleSignIn } from "@/features/auth/use-auth";
import { landingRouteFor } from "@/features/auth/use-session";
import type { AppRole } from "@/lib/api";
import { toast } from "@/lib/sonner";

type Props = {
  /**
   * Which experience to open afterwards. A hint the server VERIFIES against
   * the account's stored role — it never grants one, exactly as on a password
   * login. Omitted on the welcome screen, where nothing has been chosen yet.
   */
  intendedRole?: AppRole;
  /** `outline-inverse` on the dark welcome screen, `outline` on white. */
  variant?: "outline" | "outline-inverse";
};

/**
 * The whole Google flow in one button.
 *
 * One component rather than the same twenty lines on three screens — the three
 * stubs it replaces had already drifted into three different wordings of
 * "coming soon".
 *
 * It renders NOTHING when Google is not usable: this build may carry no client
 * id, or the server may have none configured. A button that exists only to
 * apologise is worse than a button that is not there, and the email path right
 * beside it works either way.
 */
export function GoogleButton({ intendedRole, variant = "outline" }: Props) {
  const router = useRouter();
  const available = useGoogleAvailable();
  const exchange = useGoogleSignIn();
  // Covers the native half of the flow too — the account chooser is open and
  // `exchange` has not been called yet, so its own isPending is still false.
  const [opening, setOpening] = useState(false);

  if (!available) return null;

  const press = async () => {
    if (opening || exchange.isPending) return;

    setOpening(true);

    const result = await signInWithGoogle();

    setOpening(false);

    // Changing your mind at the chooser is not a failure, and saying anything
    // about it would be noise over a sheet the person just dismissed.
    if (result.type === "cancelled") return;

    if (result.type !== "token") {
      toast.error("Google sign-in did not work", { description: result.message });

      return;
    }

    exchange.mutate(
      { idToken: result.idToken, intendedRole },
      {
        onError: (error) =>
          toast.error("We could not sign you in", { description: error.message }),
        onSuccess: (response) => {
          toast.success(`Welcome, ${response.data.user.name.split(" ")[0]}`);
          router.replace(landingRouteFor(response.data.user.role, response.data.hasAddress));
        },
      },
    );
  };

  return (
    <Button
      icon={<GoogleIcon />}
      label="Continue with Google"
      loading={opening || exchange.isPending}
      onPress={press}
      variant={variant}
    />
  );
}
