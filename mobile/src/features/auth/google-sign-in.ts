import {
  GoogleSignin,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";

/**
 * Google sign-in, as far as getting an ID token.
 *
 * The token is all this layer produces. Verifying it, matching it to an
 * account and minting a session all happen on the API, because a client that
 * decided who it was would be a client that could decide to be anyone.
 *
 * The WEB client id is what goes here, not the Android one — counter-intuitive,
 * but it is the audience Google puts in the ID token's `aud`, and it is what
 * the server checks against. The Android client id is read from
 * google-services.json by the native module and never named in JS.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** Android's CommonStatusCodes.DEVELOPER_ERROR, which the module stringifies. */
const DEVELOPER_ERROR_CODE = "10";

/** True when this build was given a client to sign in against. */
export const isGoogleConfigured = (): boolean => Boolean(WEB_CLIENT_ID);

let configured = false;

const configure = () => {
  if (configured || !WEB_CLIENT_ID) return;

  GoogleSignin.configure({
    // Email and profile only. We ask for nothing we do not use, which also
    // keeps the consent screen to one line.
    scopes: ["email", "profile"],
    webClientId: WEB_CLIENT_ID,
  });

  configured = true;
};

export type GoogleResult =
  | { type: "token"; idToken: string }
  | { type: "cancelled" }
  | { type: "unavailable"; message: string }
  | { type: "error"; message: string };

/**
 * Returns a tagged result rather than throwing.
 *
 * Cancelling is not an error — someone who changes their mind at the account
 * chooser should see nothing at all, and a thrown exception makes that very
 * hard to tell apart from a real failure at the call site.
 */
export const signInWithGoogle = async (): Promise<GoogleResult> => {
  if (!WEB_CLIENT_ID) {
    return {
      message: "This build has no Google client configured.",
      type: "unavailable",
    };
  }

  configure();

  try {
    // Play Services can be missing or out of date, which is a fixable thing
    // worth naming rather than a generic failure.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();

    if (response.type === "cancelled") return { type: "cancelled" };

    const { idToken } = response.data;

    if (!idToken) {
      // Configured with the wrong client id, almost always. Google returns the
      // account but no token to prove it with.
      return {
        message: "Google signed you in but sent no token. Check the web client id.",
        type: "error",
      };
    }

    return { idToken, type: "token" };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { type: "cancelled" };

      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          message: "Google Play Services is not available on this phone.",
          type: "unavailable",
        };
      }

      if (error.code === statusCodes.IN_PROGRESS) {
        // A second tap while the chooser is already open. Silent: the sheet
        // they are looking at IS the feedback.
        return { type: "cancelled" };
      }

      // The one that will actually happen in the field, and the one whose own
      // message says least. `statusCodes` has no name for it — the native
      // module rejects with Android's raw CommonStatusCodes.DEVELOPER_ERROR,
      // which is the string "10" — so it is matched on the code and the
      // message both, in case either changes.
      if (error.code === DEVELOPER_ERROR_CODE || error.message?.includes("DEVELOPER_ERROR")) {
        return {
          message:
            "Google rejected this app's credentials. The signing key's SHA-1 fingerprint has to be registered on the OAuth client.",
          type: "error",
        };
      }
    }

    return {
      message: error instanceof Error ? error.message : "Google sign-in failed.",
      type: "error",
    };
  }
};

/**
 * Clears the Google session alongside ours.
 *
 * Without this, signing out and tapping Google again silently returns the same
 * account with no chooser — which looks like the app ignoring the sign-out.
 */
export const signOutOfGoogle = async (): Promise<void> => {
  if (!WEB_CLIENT_ID) return;

  try {
    configure();
    await GoogleSignin.signOut();
  } catch {
    // Local sign-out must not depend on Google being reachable.
  }
};
