import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Task 02 - Non-Sensitive Storage
 * 
 * Digunakan untuk data umum yang TIDAK sensitif (seperti preferensi tema, bahasa, atau preferensi UI).
 * Terpisah secara tegas dari Secure Storage.
 */
export const LOCAL_KEYS = {
  THEME_PREFERENCE: '@app_theme_pref',
  LANGUAGE: '@app_language',
  NOTIFICATION_SETTINGS: '@app_notif_settings',
} as const;

export const localStorage = {
  async setItem(key: string, value: any): Promise<void> {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, str);
    } catch (e) {
      console.warn(`AsyncStorage setItem error for [${key}]:`, e);
    }
  },

  async getItem<T = any>(key: string): Promise<T | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (!val) return null;
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as unknown as T;
      }
    } catch (e) {
      console.warn(`AsyncStorage getItem error for [${key}]:`, e);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`AsyncStorage removeItem error for [${key}]:`, e);
    }
  },
};
