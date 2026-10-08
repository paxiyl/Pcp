import * as SecureStore from "expo-secure-store";

/**
 * Push notifications, behind one seam.
 *
 * `expo-notifications` is NOT a dependency yet. It is a native module, so adding
 * it changes the build and needs a prebuild — not something to slip in silently:
 *
 *   npx expo install expo-notifications
 *   npx expo prebuild --clean
 *
 * then replace the two bodies below with `Notifications.getPermissionsAsync()`
 * and `requestPermissionsAsync()` / `getExpoPushTokenAsync()`. Every call site is
 * already correct.
 *
 * The decision itself is stored either way, because the thing that actually
 * matters here is not the OS permission — it is that we only ever ask ONCE, at a
 * moment the customer can see the point of it.
 */

const ASKED_KEY = "onlinemall.pushAsked";
const CHOICE_KEY = "onlinemall.pushChoice";

export type PushChoice = "granted" | "declined" | "unasked";

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
 * iOS gives exactly one chance at the system prompt: once it is dismissed, the
 * only way back is Settings. So the app asks its own question first, and only
 * reaches the OS prompt after the customer has already said yes to ours. Asking
 * at app launch — before there is any order to be notified about — is how that
 * one chance gets wasted.
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

/**
 * Called after the customer accepts OUR primer. Once the SDK is installed this
 * is where the system prompt is raised and the Expo push token is registered.
 */
export const enablePush = async (): Promise<boolean> => {
  await remember("granted");

  return true;
};

export const declinePush = async (): Promise<void> => {
  await remember("declined");
};
