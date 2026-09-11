import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Receipt, MapPin } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { OrderListSkeleton } from '../../../components/ui/Skeleton';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { apiClient } from '../../../lib/api-client';

import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

interface OrderItem {
  id: string;
  title: { en: string; hi: string; mr?: string | null };
  image_url: string | null;
  unit_price: number;
  quantity: number;
}

interface Order {
  id: string;
  seller_name: string;
  fulfillment_status: number;
  total_price: number;
  payment_method: string;
  items: OrderItem[];
  created_at: string;
}

export default function CustomerOrdersScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const statusLabels = [t('orders.stepReceived'), t('orders.stepPacked'), t('orders.stepPickedUp'), t('orders.stepDelivered')];
  const statusToBadge = (status: number) => (status >= 4 ? 'live' : 'draft');

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setLoadError(false);
      const controller = new AbortController();
      apiClient
        .get('/orders/buying', { signal: controller.signal })
        .then((res) => { if (!controller.signal.aborted) setOrders(res.data); })
        .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
      return () => controller.abort();
    }, [attempt])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('customer.tabOrders')}</Text>
      </View>

      {loading ? <OrderListSkeleton /> : <>
      <RequestFeedback error={loadError ? t('common.loadFailed') : null} onRetry={() => setAttempt((value) => value + 1)} />
      {!loadError && orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Receipt size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('customer.emptyOrdersTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('customer.emptyOrdersMessage')}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 70).duration(280)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sellerName}>{t('customer.orderedFrom', { name: item.seller_name })}</Text>
                <StatusBadge status={statusToBadge(item.fulfillment_status)} label={statusLabels[item.fulfillment_status - 1]} />
              </View>

              {item.items.map((line) => (
                <View key={line.id} style={styles.itemRow}>
                  {line.image_url ? (
                    <Image source={{ uri: mediaUrl(line.image_url, HOST_URL)! }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.itemImage, styles.itemImagePlaceholder]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{productText(line.title, i18n.language)}</Text>
                    <Text style={styles.itemMeta}>{t('orders.qty', { count: line.quantity })} · ₹{line.unit_price.toLocaleString('en-IN')}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.footerRow}>
                <Text style={styles.paymentLabel}>{item.payment_method === 'cod' ? t('orders.codLabel') : item.payment_method}</Text>
                <Text style={styles.totalText}>₹{item.total_price.toLocaleString('en-IN')}</Text>
              </View>

              {item.fulfillment_status === 3 && (
                <AnimatedPressable
                  style={styles.trackButton}
                  onPress={() => router.push(`/(app)/tracking/${item.id}` as any)}
                >
                  <MapPin size={14} color="#FFFFFF" strokeWidth={2} />
                  <Text style={styles.trackButtonText}>{t('customer.trackOrder')}</Text>
                </AnimatedPressable>
              )}
            </Animated.View>
          )}
        />
      )}
      </>}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  listContainer: {
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sellerName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  itemImagePlaceholder: {
    backgroundColor: colors.primaryTint,
  },
  itemTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  itemMeta: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  totalText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    marginTop: Spacing.sm,
  },
  trackButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
