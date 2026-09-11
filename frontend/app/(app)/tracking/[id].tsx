import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { X, Truck, PackageCheck } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing } from '../../../constants/theme';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { LeafletMap, MapMarker } from '../../../components/ui/LeafletMap';
import { apiClient } from '../../../lib/api-client';

const POLL_MS = 5000;

interface OrderTracking {
  order_id: string;
  fulfillment_status: number;
  seller_name: string;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const fetchTracking = useCallback((controller?: AbortController) => {
    return apiClient
      .get<OrderTracking>(`/orders/${id}/tracking`, { signal: controller?.signal })
      .then((res) => { if (!controller?.signal.aborted) { setTracking(res.data); setLoadError(false); } })
      .catch(() => { if (!controller?.signal.aborted) setLoadError(true); });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      setLoading(true);
      fetchTracking(controller).finally(() => { if (!controller.signal.aborted) setLoading(false); });
      const interval = setInterval(() => fetchTracking(), POLL_MS);
      return () => { controller.abort(); clearInterval(interval); };
    }, [fetchTracking, attempt])
  );

  const lastUpdatedLabel = tracking?.location_updated_at
    ? new Date(tracking.location_updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const markers: MapMarker[] = tracking?.latitude != null && tracking?.longitude != null
    ? [{ id: 'seller', lat: tracking.latitude, lng: tracking.longitude, label: tracking.seller_name, color: '#D97706' }]
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <AnimatedPressable accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>{t('customer.trackingTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <RequestFeedback loading={loading && !tracking} error={loadError ? t('common.loadFailed') : null} onRetry={() => setAttempt((v) => v + 1)} />

      {tracking && (
        <>
          {markers.length > 0 ? (
            <View style={{ flex: 1 }}>
              <LeafletMap style={{ flex: 1 }} markers={markers} center={{ lat: tracking.latitude!, lng: tracking.longitude! }} zoom={15} />
              {lastUpdatedLabel && (
                <View style={styles.statusBanner}>
                  <Truck size={16} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.statusText}>{t('customer.trackingLastUpdated', { time: lastUpdatedLabel })}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.centerState}>
              {tracking.fulfillment_status >= 4 ? (
                <>
                  <PackageCheck size={40} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.centerText}>{t('customer.trackingDelivered')}</Text>
                </>
              ) : (
                <>
                  <Truck size={40} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.centerText}>{t('customer.trackingWaiting')}</Text>
                </>
              )}
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  centerText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  statusBanner: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
  },
  statusText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
});
