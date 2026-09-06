import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { apiClient } from '../../lib/api-client';
import { UserProfile, AuthTokens } from '../../types';
import i18n from '../../lib/i18n';

interface AuthContextType {
  user: UserProfile | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  verifyFirebasePhone: (idToken: string) => Promise<{ success: boolean; is_new_user?: boolean; message?: string }>;
  devBypassLogin: () => Promise<{ success: boolean; is_new_user?: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateOnboardingStep: (step: number, data?: Partial<UserProfile>, completed?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [language, setLanguageState] = useState<string>(i18n.language || 'hi');

  // Load saved session on app startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const accessToken = await storage.getAccessToken();
        const savedUser = await storage.getUser();

        if (accessToken) {
          setTokens({ access_token: accessToken, refresh_token: '', token_type: 'bearer' });
          if (savedUser) {
            setUser(savedUser);
            if (savedUser.preferred_language) {
              setLanguageState(savedUser.preferred_language);
              i18n.changeLanguage(savedUser.preferred_language);
            }
          }
          // Fetch fresh profile from backend
          try {
            const res = await apiClient.get('/profile');
            setUser(res.data);
            await storage.saveUser(res.data);
            if (res.data.preferred_language) {
              setLanguageState(res.data.preferred_language);
              i18n.changeLanguage(res.data.preferred_language);
            }
          } catch (e) {
            // Ignore API network error on launch if saved profile exists
          }
        }
      } catch (e) {
        console.error('Failed to restore auth session:', e);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const setLanguage = async (lang: string) => {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    if (user) {
      const updated = { ...user, preferred_language: lang };
      setUser(updated);
      await storage.saveUser(updated);
      try {
        await apiClient.put('/profile', { preferred_language: lang });
      } catch (e) {
        // Ignored if offline
      }
    }
  };

  const applyAuthTokens = async (data: any) => {
    const newTokens: AuthTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type,
      is_new_user: data.is_new_user,
      onboarding_completed: data.onboarding_completed,
    };

    await storage.setAccessToken(data.access_token);
    await storage.setRefreshToken(data.refresh_token);
    setTokens(newTokens);

    const profileRes = await apiClient.get('/profile');
    setUser(profileRes.data);
    await storage.saveUser(profileRes.data);

    if (profileRes.data.preferred_language) {
      setLanguageState(profileRes.data.preferred_language);
      i18n.changeLanguage(profileRes.data.preferred_language);
    }
  };

  const verifyFirebasePhone = async (idToken: string) => {
    try {
      const res = await apiClient.post('/auth/firebase-verify', { id_token: idToken });
      await applyAuthTokens(res.data);
      return { success: true, is_new_user: res.data.is_new_user };
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Phone verification failed.';
      return { success: false, message };
    }
  };

  // Dev-only shortcut: signs in via the backend's mock-OTP path (a fixed test
  // phone number + the DEBUG-mode fixed OTP) so Firebase's SMS rate limits or
  // billing/config state never block testing the rest of the app. Only wired
  // up behind __DEV__ in the UI — never shown in a production build.
  const devBypassLogin = async () => {
    try {
      const DEV_PHONE = '9999999999';
      await apiClient.post('/auth/request-otp', { phone_number: DEV_PHONE });
      const res = await apiClient.post('/auth/verify-otp', {
        phone_number: DEV_PHONE,
        otp_code: '123456',
      });
      await applyAuthTokens(res.data);
      return { success: true, is_new_user: res.data.is_new_user };
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Dev bypass login failed.';
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    await storage.clearTokens();
    await storage.clearUser();
    await storage.clearOnboardingProgress();
    setUser(null);
    setTokens(null);
  };

  const refreshProfile = async () => {
    try {
      const res = await apiClient.get('/profile');
      setUser(res.data);
      await storage.saveUser(res.data);
    } catch (e) {
      console.error('Failed to refresh profile:', e);
    }
  };

  const updateOnboardingStep = async (step: number, data?: Partial<UserProfile>, completed = false) => {
    // Update local state first for instantaneous responsive UI
    if (user) {
      const updated = {
        ...user,
        ...data,
        onboarding_step: step,
        onboarding_completed: completed || user.onboarding_completed,
      };
      setUser(updated);
      await storage.saveUser(updated);
    }

    // Save offline progress to AsyncStorage
    await storage.saveOnboardingProgress({ step, ...data, completed });

    // Sync to backend
    try {
      const res = await apiClient.put('/profile/onboarding', {
        step,
        completed,
        ...data,
      });
      setUser(res.data);
      await storage.saveUser(res.data);
    } catch (e) {
      // Ignored if offline — will sync later
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens,
        isLoading,
        isAuthenticated: !!tokens?.access_token,
        language,
        setLanguage,
        verifyFirebasePhone,
        devBypassLogin,
        logout,
        refreshProfile,
        updateOnboardingStep,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
