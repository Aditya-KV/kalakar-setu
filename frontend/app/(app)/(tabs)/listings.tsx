import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Modal, RefreshControl, Share, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Package, Pencil, Share2, Plus, X, Check, Trash2, Images } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { getCraftIcon } from '../../../lib/craftIcons';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { useToast } from '../../../features/toast/context';
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
  gallery: { key: string; label: string; url: string }[];
  status: string;
}

export default function ListingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { showToast } = useToast();
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
        message: `${productText(item.title, i18n.language)} — ₹${item.price.toLocaleString('en-IN')}\n${item.description.en}\n\n${t('customer.shareFooter')}`,
      });
    } catch (e) {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const handleDelete = (item: Listing) => {
    Alert.alert(
      t('listings.deleteConfirmTitle'),
      t('listings.deleteConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('listings.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await apiClient.delete(`/listings/${item.id}`);
              setListings((prev) => prev.filter((l) => l.id !== item.id));
            } catch (e) {
              showToast(t('listings.deleteFailed'), 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
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
      showToast(t('common.error'), 'error');
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
                <View>
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.imageContainer} resizeMode="cover" />
                  ) : (
                    <View style={styles.imageContainer}>
                      <CategoryIcon size={32} color={colors.primary} strokeWidth={1.8} />
                    </View>
                  )}
                  {item.gallery.length > 1 && (
                    <View style={styles.photoCountBadge}>
                      <Images size={10} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.photoCountText}>{item.gallery.length}</Text>
                    </View>
                  )}
                </View>

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
                      <Text style={styles.actionText} numberOfLines={1}>{t('listings.edit')}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.actionButton} onPress={() => handleShare(item)}>
                      <Share2 size={12} color={colors.textPrimary} strokeWidth={2} />
                      <Text style={styles.actionText} numberOfLines={1}>{t('listings.share')}</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                    >
                      <Trash2 size={12} color={colors.error} strokeWidth={2} />
                      <Text style={[styles.actionText, { color: colors.error }]} numberOfLines={1}>
                        {deletingId === item.id ? t('common.loading') : t('listings.delete')}
                      </Text>
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
            {editingListing && editingListing.gallery.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editPhotoStrip}>
                {editingListing.gallery.map((photo, index) => (
                  <Image
                    key={photo.key || index}
                    source={{ uri: mediaUrl(photo.url, HOST_URL)! }}
                    style={styles.editPhotoImage}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            )}
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
  photoCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.round,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoCountText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  editPhotoStrip: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  editPhotoImage: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
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
    gap: 8,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  actionText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.errorLight,
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
