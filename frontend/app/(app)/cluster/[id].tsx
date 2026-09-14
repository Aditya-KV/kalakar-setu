import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { X, Users, Package } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { getCraftIcon } from '../../../lib/craftIcons';
import { apiClient } from '../../../lib/api-client';
import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

interface ClusterMember {
  id: string;
  display_name: string | null;
  district_code: string | null;
}

interface ClusterDetail {
  id: string;
  name: string;
  craft_type: string;
  state_code: string;
  story: string;
  member_craft_names: string[] | null;
  members: ClusterMember[];
}

interface MarketplaceListing {
  id: string;
  title: { en: string; hi: string; mr?: string | null };
  craft_type: string | null;
  price: number;
  primary_image_url: string | null;
  seller: { id: string; name: string };
}

export default function ClusterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [cluster, setCluster] = useState<ClusterDetail | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCluster = () => {
    setLoading(true);
    setError(false);
    apiClient
      .get(`/reference/clusters/${id}`)
      .then(async (res) => {
        setCluster(res.data);
        const memberIds = new Set(res.data.members.map((m: ClusterMember) => m.id));
        try {
          const listingsRes = await apiClient.get('/marketplace/listings', {
            params: { craft_type: res.data.craft_type },
          });
          setListings(listingsRes.data.filter((l: MarketplaceListing) => memberIds.has(l.seller.id)));
        } catch {
          setListings([]);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(fetchCluster, [id]);

  const CraftIcon = getCraftIcon(cluster?.craft_type ?? null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <AnimatedPressable accessibilityLabel={t('common.back')} onPress={() => router.back()} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{cluster?.name ?? ''}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error || !cluster ? (
        <View style={styles.loadingState}>
          <RequestFeedback error={t('common.loadFailed')} onRetry={fetchCluster} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(280)} style={styles.storyCard}>
            <View style={styles.iconCircle}>
              <CraftIcon size={26} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.clusterName}>{cluster.name}</Text>
            <Text style={styles.storyBody}>{cluster.story}</Text>
          </Animated.View>

          <Text style={styles.sectionTitle}>{t('customer.clusterMembersTitle')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow}>
            {cluster.members.map((member, index) => (
              <Animated.View key={member.id} entering={FadeInDown.delay(index * 40).duration(240)} style={styles.memberChip}>
                <Users size={13} color={colors.primary} strokeWidth={2} />
                <Text style={styles.memberChipText} numberOfLines={1}>
                  {member.display_name || t('customer.craftClustersTitle')}
                </Text>
              </Animated.View>
            ))}
          </ScrollView>
          <Text style={styles.memberCount}>
            {t('customer.clusterMembersCount', { count: cluster.members.length })}
          </Text>

          <Text style={styles.sectionTitle}>{t('customer.clusterListingsTitle')}</Text>
          {listings.length === 0 ? (
            <View style={styles.emptyListings}>
              <Package size={28} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyListingsText}>{t('customer.clusterEmptyListings')}</Text>
            </View>
          ) : (
            <FlatList
              data={listings}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ gap: Spacing.md }}
              scrollEnabled={false}
              contentContainerStyle={{ gap: Spacing.md }}
              renderItem={({ item }) => {
                const imageUrl = item.primary_image_url ? mediaUrl(item.primary_image_url, HOST_URL)! : null;
                return (
                  <AnimatedPressable
                    style={styles.listingCard}
                    onPress={() => router.push(`/(app)/product/${item.id}` as any)}
                  >
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.listingImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.listingImage, styles.listingImagePlaceholder]}>
                        <CraftIcon size={24} color={colors.primary} strokeWidth={1.5} />
                      </View>
                    )}
                    <Text style={styles.listingTitle} numberOfLines={2}>
                      {productText(item.title, i18n.language)}
                    </Text>
                    <Text style={styles.listingPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                  </AnimatedPressable>
                );
              }}
            />
          )}
        </ScrollView>
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
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginHorizontal: Spacing.sm,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  clusterName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  storyBody: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  memberRow: {
    gap: 8,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.round,
    backgroundColor: colors.primaryTint,
    maxWidth: 160,
  },
  memberChipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.primary,
  },
  memberCount: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    marginTop: 6,
  },
  emptyListings: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: 8,
  },
  emptyListingsText: {
    fontSize: FontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  listingCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
  listingImagePlaceholder: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  listingPrice: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
    marginTop: 2,
  },
});
