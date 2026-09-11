import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Package, MapPin, Check, Receipt } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { OrderListSkeleton } from '../../../components/ui/Skeleton';
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
  delivery_address: { recipient_name: string; city: string; state_code: string };
  fulfillment_status: number;
  total_price: number;
  payment_method: string;
  items: OrderItem[];
}

export default function OrdersScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const STEPS = [t('orders.stepReceived'), t('orders.stepPacked'), t('orders.stepPickedUp'), t('orders.stepDelivered')];

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    apiClient
      .get('/orders/selling')
      .then((res) => setOrders(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const advanceFulfillment = async (order: Order) => {
    if (order.fulfillment_status >= 4) return;
    setUpdatingId(order.id);
    setUpdateError(false);
    try {
      const res = await apiClient.patch(`/orders/${order.id}/fulfillment`, {
        fulfillment_status: order.fulfillment_status + 1,
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? res.data : o)));
    } catch (e) {
      setUpdateError(true);
    } finally {
      setUpdatingId(null);
    }
  };

  const nextActionLabel = (status: number) => {
    if (status === 1) return t('orders.markPacked');
    if (status === 2) return t('orders.markPickedUp');
    return t('orders.markDelivered');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('orders.title')}</Text>
        <Text style={styles.headerSub}>{t('orders.subtitle')}</Text>
      </View>

      {loading ? <OrderListSkeleton /> : <>
      <RequestFeedback error={loadError ? t('common.loadFailed') : null} onRetry={fetchOrders} />
      {updateError && <RequestFeedback error={t('common.updateFailed')} />}
      {!loadError && orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Receipt size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('orders.emptyTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('orders.emptyMessage')}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 90).duration(320)} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNum}>{item.delivery_address.recipient_name}</Text>
                <Text style={styles.priceValue}>₹{item.total_price.toLocaleString('en-IN')}</Text>
              </View>

              <View style={styles.buyerLocationRow}>
                <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.buyerLocation}>
                  {t('orders.buyerPrefix')}: {item.delivery_address.city}, {item.delivery_address.state_code}
                </Text>
              </View>

              {item.items.map((line) => (
                <View key={line.id} style={styles.productRow}>
                  {line.image_url ? (
                    <Image source={{ uri: mediaUrl(line.image_url, HOST_URL)! }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImage}>
                      <Package size={28} color={colors.primary} strokeWidth={1.8} />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={styles.productTitleEn}>{productText(line.title, i18n.language)}</Text>
                    <Text style={styles.qtyText}>{t('orders.qty', { count: line.quantity })}</Text>
                  </View>
                </View>
              ))}

              {/* Stepped Fulfillment Progress */}
              <View style={styles.stepsRow}>
                {STEPS.map((step, stepIndex) => {
                  const stepNum = stepIndex + 1;
                  const isDone = stepNum <= item.fulfillment_status;
                  const isCurrent = stepNum === item.fulfillment_status;

                  return (
                    <React.Fragment key={step}>
                      <View style={styles.stepItem}>
                        <View
                          style={[
                            styles.stepDot,
                            isDone && styles.stepDotDone,
                            isCurrent && styles.stepDotCurrent,
                          ]}
                        >
                          {isDone && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                        </View>
                        <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>
                          {step}
                        </Text>
                      </View>

                      {stepIndex < STEPS.length - 1 && (
                        <View
                          style={[
                            styles.stepLine,
                            stepNum < item.fulfillment_status && styles.stepLineDone,
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* Action Button */}
              {item.fulfillment_status < 4 ? (
                <Button
                  title={nextActionLabel(item.fulfillment_status)}
                  onPress={() => advanceFulfillment(item)}
                  loading={updatingId === item.id}
                  disabled={updatingId !== null}
                  style={{ marginTop: Spacing.sm }}
                />
              ) : (
                <View style={styles.deliveredBadge}>
                  <Check size={14} color={colors.success} strokeWidth={3} />
                  <Text style={styles.deliveredText}>{t('orders.deliveredLabel')}</Text>
                </View>
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
  headerSub: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
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
    paddingBottom: 80,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNum: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.textSecondary,
  },
  priceValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  buyerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  buyerLocation: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  productRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitleEn: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  qtyText: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.md,
    paddingHorizontal: 4,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: colors.success,
  },
  stepDotCurrent: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primaryTint,
  },
  stepLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  stepLabelDone: {
    color: colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    marginBottom: 14,
  },
  stepLineDone: {
    backgroundColor: colors.success,
  },
  deliveredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.successLight,
  },
  deliveredText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.success,
  },
});
