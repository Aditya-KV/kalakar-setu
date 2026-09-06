import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'kalakar_access_token';
const REFRESH_TOKEN_KEY = 'kalakar_refresh_token';
const USER_KEY = 'kalakar_user_data';
const ONBOARDING_KEY = 'kalakar_onboarding_draft';
const DRAFTS_KEY = 'kalakar_product_drafts';
const THEME_KEY = 'kalakar_theme_mode';
const APP_MODE_KEY = 'kalakar_app_mode';

// Web fallback for Expo Web testing
const memoryStorage: Record<string, string> = {};

export const storage = {
  // --- Secure Storage for Tokens ---
  async getAccessToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return memoryStorage[TOKEN_KEY] || null;
    }
  },

  async setAccessToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch {
      memoryStorage[TOKEN_KEY] = token;
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return memoryStorage[REFRESH_TOKEN_KEY] || null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
      }
    } catch {
      memoryStorage[REFRESH_TOKEN_KEY] = token;
    }
  },

  async clearTokens(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      }
    } catch {
      delete memoryStorage[TOKEN_KEY];
      delete memoryStorage[REFRESH_TOKEN_KEY];
    }
  },

  // --- Async Storage for User Profile & Onboarding ---
  async saveUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      memoryStorage[USER_KEY] = JSON.stringify(user);
    }
  },

  async getUser(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return memoryStorage[USER_KEY] ? JSON.parse(memoryStorage[USER_KEY]) : null;
    }
  },

  async clearUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(USER_KEY);
    } catch {
      delete memoryStorage[USER_KEY];
    }
  },

  // --- Onboarding Progress Persistence (FR-1.7) ---
  async saveOnboardingProgress(data: any): Promise<void> {
    const existing = await storage.getOnboardingProgress();
    const merged = { ...existing, ...data };
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(merged));
    } catch {
      memoryStorage[ONBOARDING_KEY] = JSON.stringify(merged);
    }
  },

  async getOnboardingProgress(): Promise<any | null> {
    try {
      const raw = await AsyncStorage.getItem(ONBOARDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return memoryStorage[ONBOARDING_KEY] ? JSON.parse(memoryStorage[ONBOARDING_KEY]) : null;
    }
  },

  async clearOnboardingProgress(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
    } catch {
      delete memoryStorage[ONBOARDING_KEY];
    }
  },

  // --- Theme Preference ---
  async getThemeMode(): Promise<'light' | 'dark' | 'system' | null> {
    try {
      return (await AsyncStorage.getItem(THEME_KEY)) as 'light' | 'dark' | 'system' | null;
    } catch {
      return (memoryStorage[THEME_KEY] as 'light' | 'dark' | 'system' | undefined) || null;
    }
  },

  async setThemeMode(mode: 'light' | 'dark' | 'system'): Promise<void> {
    try {
      await AsyncStorage.setItem(THEME_KEY, mode);
    } catch {
      memoryStorage[THEME_KEY] = mode;
    }
  },

  // --- App Mode (Seller / Customer) ---
  async getAppMode(): Promise<'seller' | 'customer' | null> {
    try {
      return (await AsyncStorage.getItem(APP_MODE_KEY)) as 'seller' | 'customer' | null;
    } catch {
      return (memoryStorage[APP_MODE_KEY] as 'seller' | 'customer' | undefined) || null;
    }
  },

  async setAppMode(mode: 'seller' | 'customer'): Promise<void> {
    try {
      await AsyncStorage.setItem(APP_MODE_KEY, mode);
    } catch {
      memoryStorage[APP_MODE_KEY] = mode;
    }
  },
};
