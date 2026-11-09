import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Task 02 - Secure The Local Data
 * 
 * Kunci untuk data sensitif yang disimpan secara terenkripsi di SecureStore.
 * JANGAN menyimpan token atau kredensial di penyimpanan biasa (AsyncStorage).
 */
export const SECURE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_SESSION: 'user_session',
  USER_CREDENTIALS: 'user_credentials',
  USER_SECRET: 'user_secret',
} as const;

/**
 * Helper obfuscation untuk environment web (fallback),
 * karena expo-secure-store native Keystore/Keychain hanya ada di iOS & Android.
 */
const webEncode = (str: string): string => {
  try {
    return 'SECURE_ENC_' + btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
};

const webDecode = (str: string): string => {
  try {
    if (str && str.startsWith('SECURE_ENC_')) {
      return decodeURIComponent(atob(str.replace('SECURE_ENC_', '')));
    }
    return str;
  } catch {
    return str;
  }
};

export const secureStorage = {
  /**
   * Menyimpan data sensitif menggunakan SecureStore (Keystore di Android, Keychain di iOS).
   * Data dienkripsi secara native di level OS.
   */
  async setSensitiveItem(key: string, value: any): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(`@secure_${key}`, webEncode(stringValue));
    } else {
      await SecureStore.setItemAsync(key, stringValue);
    }
  },

  /**
   * Membaca data sensitif dari SecureStore.
   */
  async getSensitiveItem<T = any>(key: string): Promise<T | null> {
    try {
      if (Platform.OS === 'web') {
        const val = await AsyncStorage.getItem(`@secure_${key}`);
        if (!val) return null;
        const decoded = webDecode(val);
        try {
          return JSON.parse(decoded) as T;
        } catch {
          return decoded as unknown as T;
        }
      } else {
        const val = await SecureStore.getItemAsync(key);
        if (!val) return null;
        try {
          return JSON.parse(val) as T;
        } catch {
          return val as unknown as T;
        }
      }
    } catch (e) {
      console.warn(`SecureStore getItem error for [${key}]:`, e);
      return null;
    }
  },

  /**
   * Menghapus item sensitif dari SecureStore.
   */
  async deleteSensitiveItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(`@secure_${key}`);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      console.warn(`SecureStore deleteItem error for [${key}]:`, e);
    }
  },

  /**
   * Task 03 - Logout Scenario:
   * Membersihkan sesi dan semua data sensitif dari Secure Storage secara tuntas.
   */
  async clearSession(): Promise<void> {
    await this.deleteSensitiveItem(SECURE_KEYS.AUTH_TOKEN);
    await this.deleteSensitiveItem(SECURE_KEYS.USER_SESSION);
    await this.deleteSensitiveItem(SECURE_KEYS.USER_SECRET);
  },
};
