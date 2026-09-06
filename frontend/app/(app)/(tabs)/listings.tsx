import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Modal, RefreshControl, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Package, Pencil, Share2, Plus, X, Check } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { getCraftIcon } from '../../../lib/craftIcons';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { apiClient } from '../../../lib/api-client';

import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

interface Listing {
  id: string;
  title: { en: string; hi: string; mr?: string | null };
  description: { en: string; hi: string; mr?: string | null };
  craft_type: string | null;
  price: number;
  quantity_available: number;
  primary_image_url: string | null;
  status: string;
}

export default function ListingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const showNativeTitle = i18n.language.split('-')[0] === 'hi';

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiClient.get('/listings');
      setListings(res.data);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchListings();
    }, [fetchListings])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings();
  };

  const handleShare = async (item: Listing) => {
    try {
      await Share.share({
        message: `${productText(item.title, i18n.language)} — ₹${item.price.toLocaleString('en-IN')}\n${item.description.en}`,
      });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const openEdit = (item: Listing) => {
    setEditingListing(item);
    setEditTitle(item.title.en);
    setEditPrice(String(item.price));
  };

  const handleSaveEdit = async () => {
    if (!editingListing) return;
    const priceNumber = parseInt(editPrice, 10);
    if (!editTitle.trim() || !priceNumber) return;

    setSaving(true);
    try {
      await apiClient.patch(`/listings/${editingListing.id}`, {
        title: { ...editingListing.title, en: editTitle.trim() },
        price: priceNumber,
      });
      setEditingListing(null);
      fetchListings();
    } catch (e) {
      console.error('Failed to update listing:', e);
      Alert.alert(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('listings.title')}</Text>
        <Text style={styles.headerSub}>{t('listings.subtitle')}</Text>
      </View>

      <RequestFeedback loading={loading} error={loadError ? t('common.loadFailed') : null} onRetry={fetchListings} />
      {updateError && <RequestFeedback error={t('common.updateFailed')} />}
      {!loading && !loadError && listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('listings.emptyTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('listings.emptyMessage')}</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item, index }) => {
            const CategoryIcon = getCraftIcon(item.craft_type);
            const imageUrl = item.primary_image_url ? mediaUrl(item.primary_image_url, HOST_URL)! : null;
            return (
              <Animated.View entering={FadeInDown.delay(index * 70).duration(300)} style={styles.productCard}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.imageContainer} resizeMode="cover" />
                ) : (
                  <View style={styles.imageContainer}>
                    <CategoryIcon size={32} color={colors.primary} strokeWidth={1.8} />
                  </View>
                )}

                <View style={styles.detailsContainer}>
                  <View style={styles.topRow}>
                    <Text style={styles.categoryText}>{item.craft_type || ''}</Text>
                    <StatusBadge status={item.status} />
                  </View>

                  <Text style={styles.productTitleEn}>{productText(item.title, i18n.language)}</Text>
                  

                  <Text style={styles.priceText}>₹{item.price.toLocaleString('en-IN')}</Text>

                  <View style={styles.cardActions}>
                    <AnimatedPressable style={styles.actionButton} onPress={() => openEdit(item)}>
                      <Pencil size={12} color={colors.textPrimary} strokeWidth={2} />
                      <Text style={styles.actionText}>{t('listings.edit')}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionButton} onPress={() => handleShare(item)}>
                      <Share2 size={12} color={colors.textPrimary} strokeWidth={2} />
                      <Text style={styles.actionText}>{t('listings.share')}</Text>
                    </AnimatedPressable>
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      {/* Floating Add Product FAB */}
      <Animated.View entering={ZoomIn.delay(300).duration(350)} style={styles.addFabWrapper}>
        <AnimatedPressable style={styles.addFab} onPress={() => router.push('/(app)/studio')}>
          <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
        </AnimatedPressable>
      </Animated.View>

      {/* Edit Modal */}
      <Modal visible={!!editingListing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{t('listings.edit')}</Text>
              <AnimatedPressable onPress={() => setEditingListing(null)} hitSlop={8}>
                <X size={20} color={colors.textPrimary} />
              </AnimatedPressable>
            </View>
            <Input label={t('onboarding.step1Title')} value={editTitle} onChangeText={setEditTitle} />
            <Input
              label={t('studio.priceLabel')}
              value={editPrice}
              onChangeText={(v) => setEditPrice(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              prefix="₹"
            />
            <Button
              title={t('common.save')}
              onPress={handleSaveEdit}
              loading={saving}
              icon={<Check size={18} color="#FFFFFF" />}
              size="large"
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </Modal>
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
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 80,
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
  productCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  detailsContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  productTitleEn: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  productTitleHi: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  priceText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: 6,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  addFabWrapper: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  addFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
});
