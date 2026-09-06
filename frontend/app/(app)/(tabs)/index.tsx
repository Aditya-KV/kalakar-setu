import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { User, Plus, Package, ChevronRight } from 'lucide-react-native';
import { useAuth } from '../../../features/auth/hooks';
import { useCatalogDraft } from '../../../features/catalog/context';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { Button } from '../../../components/ui/Button';
import { apiClient } from '../../../lib/api-client';
import { sellerSummary, SellerOrder } from '../../../lib/seller-summary';

interface Overview {
  active: number; pending: number; toPack: number; paidSales: number; delivered: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { draft, hasDraft, resetDraft } = useCatalogDraft();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const startNewProduct = async () => {
    setDiscarding(true);
    try {
      await resetDraft();
      setConfirmDiscard(false);
      router.push('/(app)/studio');
    } catch {
      // The provider shows the storage error and retains the existing draft.
    } finally {
      setDiscarding(false);
    }
  };

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    Promise.all([
      apiClient.get('/listings/stats', { signal: controller.signal }),
      apiClient.get<SellerOrder[]>('/orders/selling', { signal: controller.signal }),
    ]).then(([stats, orders]) => {
      if (!controller.signal.aborted) setOverview({ active: stats.data.active_listings, ...sellerSummary(orders.data) });
    }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]));

  const openDraft = () => router.push(draft.title && draft.description
    ? '/(app)/studio/price' : draft.mediaId || draft.transcript || draft.recordingUri
      ? '/(app)/studio/voice' : '/(app)/studio');
  const money = (value: number) => new Intl.NumberFormat(i18n.language.split('-')[0] + '-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(value);

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.headerBar}>
      <View style={styles.headerLeft}>
        <View style={styles.avatarCircle}><User size={20} color={colors.primary} /></View>
        <Text style={styles.appTitle}>{t('common.appName')}</Text>
      </View>
    </View>
    <ScrollView contentContainerStyle={styles.container} refreshControl={
      <RefreshControl refreshing={loading} onRefresh={() => setAttempt((value) => value + 1)} tintColor={colors.primary} />
    }>
      <View style={styles.greetingSection}>
        <Text style={styles.greetingTitle}>{user?.display_name
          ? t('dashboard.greeting', { name: user.display_name }) : t('dashboard.welcomeBack')}</Text>
        <Text style={styles.greetingSubtitle}>{t('dashboard.manageShop')}</Text>
      </View>
      <RequestFeedback loading={loading && !overview} error={error ? t('dashboard.loadFailed') : null}
        onRetry={() => setAttempt((value) => value + 1)} />
      {hasDraft && <AnimatedPressable accessibilityRole="button" style={styles.ctaCard} onPress={openDraft}>
        <View style={styles.ctaContent}>
          <View style={styles.ctaTextContainer}>
            <Text style={styles.ctaTitle}>{t('dashboard.resumeDraft')}</Text>
            <Text style={styles.ctaSub}>{t('dashboard.resumeDraftSub')}</Text>
          </View>
          <ChevronRight size={24} color="#FFFFFF" />
        </View>
      </AnimatedPressable>}
      {overview && <View style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>{t('dashboard.businessOverview')}</Text>
        <View style={[styles.statsGrid, { marginTop: Spacing.md }]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('dashboard.paidSales')}</Text>
            <Text style={styles.statValue}>{money(overview.paidSales)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{t('dashboard.activeListings')}</Text>
            <Text style={styles.statValue}>{overview.active}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <View style={styles.statsRow}>
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{overview.pending}</Text>
            <Text style={styles.miniStatLabel}>{t('dashboard.pendingOrders')}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.miniStat}>
            <Text style={styles.miniStatValue}>{overview.delivered}</Text>
            <Text style={styles.miniStatLabel}>{t('orders.deliveredLabel')}</Text>
          </View>
        </View>
      </View>}
      <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
      <AnimatedPressable accessibilityRole="button" style={styles.ctaCard} onPress={() => router.push('/(app)/(tabs)/orders')}>
        <View style={styles.ctaContent}>
          <Package size={24} color="#FFFFFF" style={{ marginRight: 16 }} />
          <View style={styles.ctaTextContainer}>
            <Text style={styles.ctaTitle}>{t('dashboard.viewOrders')}</Text>
            <Text style={styles.ctaSub}>{overview ? t('dashboard.ordersToPack', { count: overview.toPack }) : t('orders.subtitle')}</Text>
          </View>
          <ChevronRight size={24} color="#FFFFFF" />
        </View>
      </AnimatedPressable>
      <AnimatedPressable accessibilityRole="button" style={styles.actionCard} onPress={hasDraft ? () => setConfirmDiscard(true) : () => router.push('/(app)/studio')}>
        <Plus size={24} color={colors.primary} />
        <Text style={styles.actionCardTitle}>{t('dashboard.addNewProduct')}</Text>
        <Text style={styles.actionCardSub}>{t('dashboard.addNewProductSub')}</Text>
      </AnimatedPressable>
    </ScrollView>
    <Modal visible={confirmDiscard} transparent animationType="fade" onRequestClose={() => !discarding && setConfirmDiscard(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg }}>
        <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md }}>
          <Text style={styles.sectionTitle}>{t('studio.discardConfirm')}</Text>
          <Button title={t('common.cancel')} variant="outline" disabled={discarding} onPress={() => setConfirmDiscard(false)} />
          <Button title={t('studio.discard')} loading={discarding} onPress={startNewProduct} />
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
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
    paddingVertical: Spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  greetingSection: {
    marginBottom: Spacing.lg,
  },
  greetingTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  greetingSubtitle: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  overviewCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  overviewTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  statSub: {
    fontSize: 11,
    color: colors.success,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatLabel: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  miniStatValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  actionsSection: {
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.md,
  },
  ctaCard: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  ctaSub: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...Shadows.card,
  },
  actionCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
  },
  actionCardBadge: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },
  actionCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  voiceFabWrapper: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  voiceFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
});
