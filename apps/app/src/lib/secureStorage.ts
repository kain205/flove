import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const memory = new Map<string, string>();

export const secureStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? memory.get(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value);
      memory.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
      memory.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
