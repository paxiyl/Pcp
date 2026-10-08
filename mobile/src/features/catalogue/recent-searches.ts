import * as SecureStore from "expo-secure-store";

const KEY = "onlinemall.recentSearches";
const LIMIT = 8;

/**
 * Recent searches, kept on the device.
 *
 * Local rather than server-side on purpose: a search history is the most
 * revealing thing a grocery app holds — someone searching for a pregnancy test
 * or a diabetes strip has not asked us to remember that across their account.
 * It stays in the keystore, and "Clear" means gone.
 *
 * SecureStore rather than AsyncStorage because the app already depends on it for
 * the session token, so this adds no new dependency.
 */
export const getRecentSearches = async (): Promise<string[]> => {
  try {
    const raw = await SecureStore.getItemAsync(KEY);

    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    // A corrupt or unreadable entry should cost the customer nothing.
    return [];
  }
};

/**
 * Most recent first, de-duplicated case-insensitively so "Atta" does not sit
 * above "atta" as a separate memory of the same search.
 */
export const rememberSearch = async (term: string): Promise<string[]> => {
  const trimmed = term.trim();

  if (trimmed.length < 2) return getRecentSearches();

  const existing = await getRecentSearches();
  const next = [
    trimmed,
    ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, LIMIT);

  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // The list is a convenience; failing to persist it is not worth a toast.
  }

  return next;
};

export const clearRecentSearches = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing to report: the caller clears its own state regardless.
  }
};

/**
 * Shown before anything has been typed, and when there is no history yet.
 * Hand-picked for Hindaun rather than computed — a "trending" list built from a
 * handful of early orders is noise dressed as data.
 */
export const POPULAR_SEARCHES = [
  "Atta",
  "Milk",
  "Ghee",
  "Tomato",
  "Namkeen",
  "Surf Excel",
  "Paneer",
  "Tea",
] as const;
