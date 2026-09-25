import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Small key/value store: SecureStore (Keychain / Keystore) on device,
 * localStorage on web where SecureStore has no backing store.
 */
export const KEYS = {
  token: "cio.token",
  user: "cio.user",
  project: "cio.project",
  onboarded: "cio.onboarded",
} as const;

function webStore(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webStore()?.getItem(key) ?? null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore()?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
