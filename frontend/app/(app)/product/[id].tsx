import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { X, Package, MapPin, Minus, Plus, ShoppingCart } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { useCart } from '../../../features/cart/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { ImageCarousel } from '../../../components/ui/ImageCarousel';
import { getCraftIcon } from '../../../lib/craftIcons';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { apiClient } from '../../../lib/api-client';

import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

interface ListingDetail {
  id: string;
  title: { en: string; hi: string; mr?: string | null };
  description: { en: string; hi: string; mr?: string | null };
  craft_type: string | null;
  price: number;
  quantity_available: number;
  primary_image_url: string | null;
  gallery: { key: string; label: string; url: string }[];
  seller: { id: string; name: string; district_code: string | null; state_code: string | null };
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { addItem } = useCart();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListing(null);
    setQuantity(1);
    apiClient
      .get(`/marketplace/listings/${id}`, { signal: controller.signal })
      .then((res) => { if (!controller.signal.aborted) setListing(res.data); })
      .catch((e) => console.error('Failed to load product:', e))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  const inStock = (listing?.quantity_available || 0) > 0;

  const cartItemFromListing = () => {
    if (!listing) return null;
    return {
      listingId: listing.id,
      titleEn: listing.title.en,
      titleHi: listing.title.hi,
      titleMr: listing.title.mr,
      price: listing.price,
      imageUrl: listing.primary_image_url,
      sellerId: listing.seller.id,
      sellerName: listing.seller.name,
      quantityAvailable: listing.quantity_available,
    };
  };

  const handleAddToCart = () => {
    const item = cartItemFromListing();
    if (!item) return;
    addItem(item, quantity);
    Alert.alert(t('customer.addedToCart'));
  };

  const handleBuyNow = () => {
    const item = cartItemFromListing();
    if (!item) return;
    addItem(item, quantity);
    router.push('/(app)/checkout');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <AnimatedPressable accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8}>
            <X size={22} color={colors.textPrimary} />
          </AnimatedPressable>
        </View>
        <View style={styles.loadingState}>
          <RequestFeedback error={t('common.loadFailed')} onRetry={() => setAttempt((value) => value + 1)} />
        </View>
      </SafeAreaView>
    );
  }

  const CategoryIcon = getCraftIcon(listing.craft_type);
  const galleryImages = listing.gallery.length > 0
    ? listing.gallery
    : listing.primary_image_url
    ? [{ key: 'main', label: '', url: listing.primary_image_url }]
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <AnimatedPressable accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </AnimatedPressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <ImageCarousel
          height={340}
          images={galleryImages.map((variant) => ({ key: variant.key, url: mediaUrl(variant.url, HOST_URL)! }))}
          placeholder={<CategoryIcon size={56} color={colors.primary} strokeWidth={1.5} />}
        />

        <Animated.View entering={FadeInDown.duration(300)} style={styles.detailBlock}>
          <Text style={styles.title}>{productText(listing.title, i18n.language)}</Text>
          
          <Text style={styles.price}>₹{listing.price.toLocaleString('en-IN')}</Text>

          <View style={styles.sellerRow}>
            <MapPin size={13} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.sellerText}>
              {t('customer.soldBy')} {listing.seller.name}
              {listing.seller.district_code ? ` · ${listing.seller.district_code}` : ''}
            </Text>
          </View>

          {!inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>{t('customer.outOfStock')}</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>{t('common.description')}</Text>
          <Text style={styles.description}>{productText(listing.description, i18n.language)}</Text>
          {i18n.language.split('-')[0] === 'mr' && !listing.description.mr && <Text style={styles.descriptionNative}>{t('common.translationFallback')}</Text>}
          

          {inStock && (
            <View style={styles.quantityRow}>
              <Text style={styles.sectionLabel}>{t('customer.quantity')}</Text>
              <View style={styles.stepper}>
                <AnimatedPressable
                  style={styles.stepperButton}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus size={16} color={colors.textPrimary} />
                </AnimatedPressable>
                <Text style={styles.stepperValue}>{quantity}</Text>
                <AnimatedPressable
                  style={styles.stepperButton}
                  onPress={() => setQuantity((q) => Math.min(listing.quantity_available, q + 1))}
                >
                  <Plus size={16} color={colors.textPrimary} />
                </AnimatedPressable>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {inStock && (
        <Animated.View entering={FadeIn.delay(150).duration(300)} style={styles.footer}>
          <AnimatedPressable accessibilityLabel={t('customer.addToCart')} style={styles.addToCartButton} onPress={handleAddToCart}>
            <ShoppingCart size={18} color={colors.primary} strokeWidth={2} />
          </AnimatedPressable>
          <Button title={t('customer.buyNow')} onPress={handleBuyNow} style={{ flex: 1 }} size="large" />
        </Animated.View>
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  detailBlock: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  titleNative: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  price: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.primary,
    marginTop: Spacing.sm,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
  },
  sellerText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  outOfStockBadge: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  outOfStockText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.error,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    color: colors.textPrimary,
    lineHeight: 21,
  },
  descriptionNative: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  quantityRow: {
    marginTop: Spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  stepperButton: {
    padding: 10,
  },
  stepperValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  addToCartButton: {
    width: TouchTargetSize,
    height: TouchTargetSize,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const TouchTargetSize = 56;
