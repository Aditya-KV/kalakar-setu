import React from 'react';
import { View, Text, StyleSheet, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { ShoppingCart, Minus, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { useCart, CartItem } from '../../../features/cart/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { getCraftIcon } from '../../../lib/craftIcons';

import { apiClient } from '../../../lib/api-client';
import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { items, totalPrice, updateQuantity, removeItem } = useCart();
  const showNative = i18n.language.split('-')[0] === 'hi';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('customer.tabCart')}</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <ShoppingCart size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('customer.emptyCartTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('customer.emptyCartMessage')}</Text>
          <Button
            title={t('customer.browseProducts')}
            onPress={() => router.push('/(app)/(customer-tabs)')}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.listingId}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }: { item: CartItem; index: number }) => {
              const CategoryIcon = getCraftIcon(null);
              const imageUrl = item.imageUrl ? mediaUrl(item.imageUrl, HOST_URL)! : null;
              return (
                <Animated.View
                  entering={FadeInDown.delay(index * 60).duration(280)}
                  exiting={FadeOut.duration(200)}
                  style={styles.card}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
                  ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                      <CategoryIcon size={24} color={colors.primary} strokeWidth={1.5} />
                    </View>
                  )}

                  <View style={styles.cardBody}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{productText({ en: item.titleEn, hi: item.titleHi, mr: item.titleMr }, i18n.language)}</Text>
                    <Text style={styles.itemSeller}>{t('customer.orderedFrom', { name: item.sellerName })}</Text>
                    <Text style={styles.itemPrice}>₹{item.price.toLocaleString('en-IN')}</Text>

                    <View style={styles.actionsRow}>
                      <View style={styles.stepper}>
                        <AnimatedPressable
                          style={styles.stepperButton}
                          onPress={() => updateQuantity(item.listingId, item.quantity - 1)}
                        >
                          <Minus size={14} color={colors.textPrimary} />
                        </AnimatedPressable>
                        <Text style={styles.stepperValue}>{item.quantity}</Text>
                        <AnimatedPressable
                          style={styles.stepperButton}
                          onPress={() => updateQuantity(item.listingId, item.quantity + 1)}
                        >
                          <Plus size={14} color={colors.textPrimary} />
                        </AnimatedPressable>
                      </View>

                      <AnimatedPressable onPress={() => removeItem(item.listingId)} hitSlop={8}>
                        <Trash2 size={16} color={colors.error} strokeWidth={2} />
                      </AnimatedPressable>
                    </View>
                  </View>
                </Animated.View>
              );
            }}
          />

          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('customer.total')}</Text>
              <Text style={styles.totalValue}>₹{totalPrice.toLocaleString('en-IN')}</Text>
            </View>
            <Button
              title={t('customer.checkout')}
              onPress={() => router.push('/(app)/checkout')}
              size="large"
            />
          </View>
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
    paddingBottom: 80,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  image: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.md,
  },
  imagePlaceholder: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  itemSeller: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
  },
  stepperButton: {
    padding: 6,
  },
  stepperValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    minWidth: 16,
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.lg,
    marginBottom: 64,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  totalLabel: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
});
