import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../features/auth/hooks';
import { useCatalogDraft } from '../../features/catalog/context';
import { RequestFeedback } from '../../components/ui/RequestFeedback';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { ready, loadError, retryRestore } = useCatalogDraft();
  const { t } = useTranslation();

  if (isLoading) {
    return null; // Or custom splash
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!ready) return <RequestFeedback loading={!loadError} error={loadError ? t('studio.restoreFailed') : null} onRetry={retryRestore} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(customer-tabs)" />
      <Stack.Screen name="studio" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tracking/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="checkout" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
