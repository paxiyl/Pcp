import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "chowly.accessToken";

/**
 * The access token lives in the device keychain/keystore, never in AsyncStorage.
 * The API accepts it as `Authorization: Bearer <token>`.
 */
export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
};

export const clearAccessToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
};
