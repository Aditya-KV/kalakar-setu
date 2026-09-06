import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { gluestackTheme } from '../constants/gluestackTheme';
import { AuthProvider } from '../features/auth/context';
import { ThemeProvider, useTheme } from '../features/theme/context';
import { CatalogDraftProvider } from '../features/catalog/context';
import { AppModeProvider } from '../features/appMode/context';
import { CartProvider } from '../features/cart/context';
import '../lib/i18n'; // Initialize i18n

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme();
  return (
    <GluestackUIProvider config={gluestackTheme} colorMode={scheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </GluestackUIProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          <AppModeProvider>
            <CartProvider>
              <CatalogDraftProvider>
                <ThemedApp>
                  <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                  </Stack>
                </ThemedApp>
              </CatalogDraftProvider>
            </CartProvider>
          </AppModeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
