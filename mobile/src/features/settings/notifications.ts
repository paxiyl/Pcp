import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { registerPushTokenMutationFn, removePushTokenMutationFn } from "@/lib/api";

/**
 * Push notifications.
 *
 * The decision is stored separately from the OS permission, because the thing
 * that actually matters is not whether Android said yes — it is that we only
 * ever ask ONCE, at a moment the customer can see the point of it.
 */

const ASKED_KEY = "onlinemall.pushAsked";
const CHOICE_KEY = "onlinemall.pushChoice";
const TOKEN_KEY = "onlinemall.pushToken";

export type PushChoice = "granted" | "declined" | "unasked";

/** Banners while the app is open. Without this, a foreground push is silent. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Android 8+ ignores any notification whose channel does not exist, silently.
 * Creating it is idempotent, so this runs on every start rather than being
 * tracked as state that could drift.
 */
export const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return;

  try {
    await Notifications.setNotificationChannelAsync("orders", {
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#1FA85C",
      name: "Order updates",
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {
    // A channel that cannot be created means no notifications, not a crash.
  }
};

export const getPushChoice = async (): Promise<PushChoice> => {
  try {
    const stored = await SecureStore.getItemAsync(CHOICE_KEY);

    return stored === "granted" || stored === "declined" ? stored : "unasked";
  } catch {
    return "unasked";
  }
};

/**
 * Whether the primer is worth showing.
 *
 * The app asks its own question first, and only reaches the OS prompt after
 * the customer has already said yes to ours. Asking at launch — before there
 * is any order to be notified about — is how that one chance gets wasted.
 */
export const shouldAskForPush = async (): Promise<boolean> => {
  try {
    return (await SecureStore.getItemAsync(ASKED_KEY)) !== "yes";
  } catch {
    // If we cannot tell whether we have asked, do not ask: a repeated prompt is
    // worse than a missed one.
    return false;
  }
};

const remember = async (choice: PushChoice) => {
  try {
    await SecureStore.setItemAsync(ASKED_KEY, "yes");
    await SecureStore.setItemAsync(CHOICE_KEY, choice);
  } catch {
    // Not worth surfacing; the worst case is being asked again next launch.
  }
};

/** Called after the customer accepts OUR primer. */
export const enablePush = async (): Promise<boolean> => {
  // An emulator has no FCM token to give, so asking would always fail.
  if (!Device.isDevice) {
    await remember("declined");

    return false;
  }

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    const decision =
      existing.granted || existing.status === "granted"
        ? existing
        : await Notifications.requestPermissionsAsync();

    if (!decision.granted && decision.status !== "granted") {
      await remember("declined");

      return false;
    }

    // The raw FCM token, not an Expo push token: the server talks to Firebase
    // directly, so there is no Expo project to route through.
    const { data: token } = await Notifications.getDevicePushTokenAsync();

    await registerPushTokenMutationFn(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await remember("granted");

    return true;
  } catch {
    // Permission may well have been granted even if registering the token
    // failed, but without a token on the server nothing can be delivered —
    // so this counts as off, and the customer can retry from their profile.
    await remember("declined");

    return false;
  }
};

export const declinePush = async (): Promise<void> => {
  await remember("declined");
};

/**
 * Called on sign-out. Without this the next person to sign in on this phone
 * keeps receiving the previous account's order updates.
 */
export const releasePushToken = async (): Promise<void> => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!token) return;

    await removePushTokenMutationFn(token);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Best effort: a stale token on the server is dropped when FCM reports it
    // as unregistered.
  }
};
