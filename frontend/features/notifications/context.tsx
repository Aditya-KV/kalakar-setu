import React, { createContext, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/hooks';
import { apiClient } from '../../lib/api-client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface NotificationsContextType {}

const NotificationsContext = createContext<NotificationsContextType>({});

/**
 * Registers this device's Expo push token with the backend whenever the
 * user is signed in, and routes to the relevant screen when a
 * notification is tapped. Best-effort throughout — a denied permission
 * or a failed registration just means no push notifications, never a
 * blocking error for the rest of the app.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const registeredForUserId = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  }, []);

  useEffect(() => {
    if (!user?.id || registeredForUserId.current === user.id) return;
    registeredForUserId.current = user.id;

    (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync();
        let granted = existing.granted;
        if (!granted && existing.canAskAgain) {
          const requested = await Notifications.requestPermissionsAsync();
          granted = requested.granted;
        }
        if (!granted) return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        await apiClient.patch('/profile/push-token', { push_token: token });
      } catch {
        // No push token this session — the rest of the app is unaffected.
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; role?: 'seller' | 'buyer' };
      if (data?.type === 'order') {
        router.push(data.role === 'buyer' ? '/(app)/(customer-tabs)/orders' : '/(app)/(tabs)/orders');
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <NotificationsContext.Provider value={{}}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
