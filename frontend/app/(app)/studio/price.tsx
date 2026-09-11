import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, Package, ArrowRight, Camera, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { useAuth } from '../../../features/auth/hooks';
import { useCatalogDraft } from '../../../features/catalog/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { apiClient } from '../../../lib/api-client';
import { useExitToHomeOnBack } from '../../../lib/exit-to-home';

import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

export default function PriceScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { user } = useAuth();
  const { draft, resetDraft, updateDraft } = useCatalogDraft();

  const price = draft.price;
  const setPrice = (price: string) => updateDraft({ price });
  const quantity = draft.quantity;
  const setQuantity = (quantity: string) => updateDraft({ quantity });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(false);
  const publishLock = useRef(false);
  useExitToHomeOnBack(!publishing);

  interface PriceSuggestion {
    suggested_price: number;
    price_range_min: number;
    price_range_max: number;
    reasoning: { en: string; hi: string };
    confidence: string;
    reference_prices?: { median: number; min: number; max: number; sample_size: number } | null;
  }
  const [suggestion, setSuggestion] = useState<PriceSuggestion | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictionUnavailable, setPredictionUnavailable] = useState(false);
  const [predictionError, setPredictionError] = useState(false);

  const hasDraft = !!draft.title && !!draft.description;
  const priceNumber = parseInt(price, 10);
  const quantityNumber = Number(quantity);
  const validPrice = Number.isInteger(priceNumber) && priceNumber >= 1 && priceNumber <= 10000000;
  const validQuantity = Number.isInteger(quantityNumber) && quantityNumber >= 1 && quantityNumber <= 100000;
  const canPublish = hasDraft && validPrice && validQuantity && !publishing;

  const primaryImageUrl = mediaUrl(draft.photos[0]?.gallery[0]?.url || draft.photos[0]?.photoUri, HOST_URL);

  const handlePublish = async () => {
    if (!canPublish || !draft.title || !draft.description || publishLock.current) return;
    publishLock.current = true;
    setPublishError(false);
    setPublishing(true);
    try {
      await apiClient.post('/listings', {
        media_ids: draft.photos.map((photo) => photo.mediaId).filter((id): id is string => !!id),
        title: draft.title,
        description: draft.description,
        craft_type: draft.craftType || user?.craft_types?.[0] || null,
        attributes: draft.attributes || { material: [], color: [], technique: [] },
        keywords: draft.keywords,
        price: priceNumber,
        quantity_available: quantityNumber,
      });
      try { await resetDraft(); } catch { Alert.alert(t('studio.publishedClearFailed')); }
      Alert.alert(t('studio.publishSuccess'));
      // dismissTo (not replace) so studio/index and studio/voice are popped
      // off the stack too — otherwise pressing back from Listings would
      // reveal those stale creation screens instead of leaving the flow.
      router.dismissTo('/(app)/(tabs)/listings');
    } catch (e) {
      console.error('Publish failed:', e);
      setPublishError(true);
    } finally {
      publishLock.current = false;
      setPublishing(false);
    }
  };

  const handlePredictPrice = async () => {
    if (!draft.title || !draft.description) return;
    setPredicting(true);
    setPredictionUnavailable(false);
    setPredictionError(false);
    setSuggestion(null);
    try {
      const res = await apiClient.post('/pricing/predict', {
        craft_type: draft.craftType || user?.craft_types?.[0] || null,
        title_en: draft.title.en,
        description_en: draft.description.en,
        materials: draft.attributes?.material || [],
        state_code: user?.state_code || null,
        district_code: user?.district_code || null,
      });
      if (res.data.available) {
        setSuggestion(res.data);
      } else {
        setPredictionUnavailable(true);
      }
    } catch (e) {
      setPredictionError(true);
    } finally {
      setPredicting(false);
    }
  };

  if (!hasDraft) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <TouchableOpacity accessibilityLabel={t('common.back')} disabled={publishing} onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <X size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('studio.priceTitle')}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.emptyState}>
          <Package size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('studio.missingDraftTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('studio.missingDraftMessage')}</Text>
          <Button
            title={t('studio.startOver')}
            onPress={() => router.replace('/(app)/studio')}
            icon={<Camera size={18} color="#FFFFFF" />}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <TouchableOpacity accessibilityLabel={t('common.back')} disabled={publishing} onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('studio.priceTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={styles.heading}>{t('studio.priceHeading')}</Text>
          <Text style={styles.subtitle}>{t('studio.priceSubtitle')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.summaryCard}>
          {primaryImageUrl ? (
            <Image source={{ uri: primaryImageUrl }} style={styles.summaryImage} resizeMode="cover" />
          ) : (
            <View style={[styles.summaryImage, styles.summaryImagePlaceholder]}>
              <Package size={26} color={colors.textMuted} strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle} numberOfLines={2}>{draft.title ? productText(draft.title, i18n.language) : ''}</Text>
            <Text style={styles.summarySubtitle} numberOfLines={1}>
              {draft.photos.length > 0 ? t('studio.photosAttached', { count: draft.photos.length }) : t('studio.savedOnDevice')}
            </Text>
            {draft.craftType && (
              <View style={styles.craftTypeBadge}>
                <Text style={styles.craftTypeBadgeText} numberOfLines={1}>
                  {draft.craftType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {draft.photos.length > 1 && (
          <Animated.View entering={FadeInDown.delay(120).duration(300)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {draft.photos.map((photo, index) => (
                <Image
                  key={`${photo.mediaId}-${index}`}
                  source={{ uri: mediaUrl(photo.gallery[0]?.url || photo.photoUri, HOST_URL)! }}
                  style={styles.photoStripImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.suggestionCard}>
          {!suggestion ? (
            <TouchableOpacity
              style={styles.suggestionCta}
              onPress={handlePredictPrice}
              disabled={predicting}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color={colors.primary} strokeWidth={2} />
              <Text style={styles.suggestionCtaText}>
                {predicting ? t('studio.priceSuggestionLoading') : t('studio.priceSuggestionCta')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View>
              <Text style={styles.suggestionRange}>
                {t('studio.priceSuggestionRange', {
                  min: suggestion.price_range_min.toLocaleString('en-IN'),
                  max: suggestion.price_range_max.toLocaleString('en-IN'),
                })}
              </Text>
              <Text style={styles.suggestionReasoning}>
                {i18n.language.split('-')[0] === 'hi' ? suggestion.reasoning.hi : suggestion.reasoning.en}
              </Text>
              {suggestion.reference_prices && (
                <View style={styles.referencePricesBadge}>
                  <Text style={styles.referencePricesText}>
                    {t('studio.priceGroundedIn', {
                      count: suggestion.reference_prices.sample_size,
                      min: suggestion.reference_prices.min.toLocaleString('en-IN'),
                      max: suggestion.reference_prices.max.toLocaleString('en-IN'),
                    })}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.suggestionUseButton}
                onPress={() => setPrice(String(suggestion.suggested_price))}
                activeOpacity={0.8}
              >
                <Text style={styles.suggestionUseText}>
                  {t('studio.priceSuggestionUse', { price: suggestion.suggested_price.toLocaleString('en-IN') })}
                </Text>
              </TouchableOpacity>
              <Text style={styles.suggestionDisclaimer}>{t('studio.priceSuggestionDisclaimer')}</Text>
            </View>
          )}
          {predictionUnavailable && <Text style={styles.suggestionNote}>{t('studio.priceSuggestionUnavailable')}</Text>}
          {predictionError && <Text style={styles.suggestionNote}>{t('studio.priceSuggestionFailed')}</Text>}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <Input
            label={t('studio.priceLabel')}
            error={price && !validPrice ? t('studio.priceInvalid') : undefined}
            placeholder={t('studio.pricePlaceholder')}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            prefix="₹"
          />
          <Input
            label={t('studio.quantityLabel')}
            error={!validQuantity ? t('studio.quantityInvalid') : undefined}
            value={quantity}
            onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
        </Animated.View>

        <RequestFeedback error={publishError ? t('studio.publishFailed') : null} />
        <Button
          title={publishing ? t('studio.publishing') : t('studio.publish')}
          onPress={handlePublish}
          disabled={!canPublish}
          loading={publishing}
          icon={!publishing ? <ArrowRight size={18} color="#FFFFFF" /> : undefined}
          size="large"
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  heading: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  suggestionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionCtaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  suggestionRange: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  suggestionReasoning: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  referencePricesBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  referencePricesText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
  },
  suggestionUseButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: BorderRadius.round,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: Spacing.sm,
  },
  suggestionUseText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  suggestionDisclaimer: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  suggestionNote: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...Shadows.card,
  },
  summaryImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
  },
  summaryImagePlaceholder: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
  },
  craftTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 6,
  },
  craftTypeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  photoStrip: {
    flexGrow: 0,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  photoStripImage: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  summaryTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  summarySubtitle: {
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
});
