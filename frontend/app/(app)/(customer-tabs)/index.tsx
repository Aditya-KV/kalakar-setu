import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TextInput, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn, LinearTransition } from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Search, Package, ArrowLeftRight, Map as MapIcon, List as ListIcon } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { useAppMode } from '../../../features/appMode/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows, TouchTarget } from '../../../constants/theme';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { getCraftIcon } from '../../../lib/craftIcons';
import { FALLBACK_CRAFTS } from '../../../components/ui/CraftPicker';
import { CraftType } from '../../../types';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { ProductGridSkeleton } from '../../../components/ui/Skeleton';
import { apiClient } from '../../../lib/api-client';
import { LeafletMap, MapMarker } from '../../../components/ui/LeafletMap';

import { mediaUrl, productText } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';
const NEARBY_POLL_MS = 8000;

interface MarketplaceListing {
  id: string;
  title: { en: string; hi: string; mr?: string | null };
  craft_type: string | null;
  price: number;
  quantity_available: number;
  primary_image_url: string | null;
  seller: { id: string; name: string };
}

interface NearbySeller {
  id: string;
  name: string;
  craft_types: string[];
  latitude: number;
  longitude: number;
  distance_km: number | null;
}

export default function DiscoverScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { setMode } = useAppMode();
  const styles = getStyles(colors);
  const showNativeTitle = i18n.language.split('-')[0] === 'hi';

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [crafts, setCrafts] = useState<CraftType[]>(FALLBACK_CRAFTS);
  const [selectedCraft, setSelectedCraft] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [nearbySellers, setNearbySellers] = useState<NearbySeller[]>([]);
  const [buyerLocation, setBuyerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  const fetchNearbySellers = useCallback(async (coords: { lat: number; lng: number } | null) => {
    try {
      const res = await apiClient.get<NearbySeller[]>('/marketplace/sellers/nearby', {
        params: coords ? { lat: coords.lat, lng: coords.lng } : {},
      });
      setNearbySellers(res.data);
    } catch {
      // A missed poll tick just keeps showing the last known pins.
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'map') return;
    let cancelled = false;
    (async () => {
      if (!buyerLocation) {
        try {
          const perm = await Location.requestForegroundPermissionsAsync();
          if (!perm.granted) {
            if (!cancelled) setLocationDenied(true);
          } else {
            const current = await Location.getCurrentPositionAsync({});
            if (!cancelled) setBuyerLocation({ lat: current.coords.latitude, lng: current.coords.longitude });
          }
        } catch {
          if (!cancelled) setLocationDenied(true);
        }
      }
      if (!cancelled) fetchNearbySellers(buyerLocation);
    })();
    const interval = setInterval(() => fetchNearbySellers(buyerLocation), NEARBY_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [viewMode, buyerLocation, fetchNearbySellers]);

  useEffect(() => {
    apiClient
      .get('/reference/crafts')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) setCrafts(res.data);
      })
      .catch(() => {
        // Offline or unreachable — keep the fallback list.
      });
  }, []);

  const fetchListings = useCallback((searchTerm?: string, craftType?: string | null) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoadError(false);
    setLoading(true);
    const params: Record<string, string> = {};
    if (searchTerm) params.search = searchTerm;
    if (craftType) params.craft_type = craftType;
    apiClient
      .get('/marketplace/listings', { params, signal: controller.signal })
      .then((res) => { if (!controller.signal.aborted) setListings(res.data); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchListings(search, selectedCraft);
      return () => request.current?.abort();
    }, [fetchListings])
  );

  const handleSearchSubmit = () => {
    setLoading(true);
    fetchListings(search, selectedCraft);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchListings(search, selectedCraft);
  };

  const handleSelectCraft = (craftId: string | null) => {
    const next = craftId === selectedCraft ? null : craftId;
    setSelectedCraft(next);
    setLoading(true);
    fetchListings(search, next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>{t('customer.tabDiscover')}</Text>
          <Text style={styles.headerSub}>Kalakar Setu</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AnimatedPressable
            style={styles.viewToggleButton}
            onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          >
            {viewMode === 'list' ? (
              <MapIcon size={14} color={colors.primary} strokeWidth={2} />
            ) : (
              <ListIcon size={14} color={colors.primary} strokeWidth={2} />
            )}
            <Text style={styles.switchButtonText}>{viewMode === 'list' ? t('customer.mapView') : t('customer.listView')}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.switchButton} onPress={() => { setMode('seller'); router.replace('/(app)/(tabs)'); }}>
            <ArrowLeftRight size={14} color={colors.primary} strokeWidth={2} />
            <Text style={styles.switchButtonText}>{t('customer.switchToSelling')}</Text>
          </AnimatedPressable>
        </View>
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          {locationDenied && (
            <Text style={styles.mapPermissionNote}>{t('customer.locationPermissionRequired')}</Text>
          )}
          <LeafletMap
            style={{ flex: 1 }}
            center={buyerLocation ? { lat: buyerLocation.lat, lng: buyerLocation.lng } : undefined}
            markers={nearbySellers.map<MapMarker>((seller) => ({
              id: seller.id,
              lat: seller.latitude,
              lng: seller.longitude,
              label: seller.name,
            }))}
          />
          {nearbySellers.length === 0 && (
            <View style={styles.mapEmptyBanner}>
              <Text style={styles.mapEmptyText}>{t('customer.nearbySellersEmpty')}</Text>
            </View>
          )}
        </View>
      ) : (
        <>
      <View style={styles.searchRow}>
        <Search size={16} color={colors.textMuted} strokeWidth={2} />
        <TextInput
          accessibilityLabel={t('customer.searchPlaceholder')}
          style={styles.searchInput}
          placeholder={t('customer.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
      </View>

      <Animated.View entering={FadeIn.duration(220)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <AnimatedPressable
            style={[styles.chip, selectedCraft === null && styles.chipActive]}
            onPress={() => handleSelectCraft(null)}
          >
            <Text style={[styles.chipText, selectedCraft === null && styles.chipTextActive]}>
              {t('customer.allCrafts')}
            </Text>
          </AnimatedPressable>
          {crafts.map((craft) => {
            const CraftIcon = getCraftIcon(craft.id);
            const isActive = selectedCraft === craft.id;
            const label = showNativeTitle ? craft.name_hi : craft.name_en;
            return (
              <AnimatedPressable
                key={craft.id}
                style={[styles.chip, isActive && styles.chipActive]}
                onPress={() => handleSelectCraft(craft.id)}
              >
                <CraftIcon size={14} color={isActive ? colors.textOnPrimary : colors.primary} strokeWidth={2} />
                <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                  {label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </Animated.View>

      {!loading && listings.length > 0 && (
        <Text style={styles.resultsCount}>
          {t('customer.resultsCount', { count: listings.length })}
        </Text>
      )}

      {loading ? (
        <ProductGridSkeleton />
      ) : (
        <RequestFeedback error={loadError ? t('common.loadFailed') : null} onRetry={handleSearchSubmit} />
      )}
      {!loading && !loadError && listings.length === 0 ? (
        <View style={styles.emptyState}>
          <Package size={40} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('customer.emptyDiscoverTitle')}</Text>
          <Text style={styles.emptyMessage}>{t('customer.emptyDiscoverMessage')}</Text>
        </View>
      ) : !loading ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: Spacing.md }}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item, index }) => {
            const CategoryIcon = getCraftIcon(item.craft_type);
            const imageUrl = item.primary_image_url ? mediaUrl(item.primary_image_url, HOST_URL)! : null;
            return (
              <Animated.View
                entering={FadeInDown.delay((index % 10) * 50).duration(280)}
                layout={LinearTransition.duration(220)}
                style={styles.cardWrapper}
              >
                <AnimatedPressable
                  style={styles.card}
                  onPress={() => router.push(`/(app)/product/${item.id}` as any)}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                      <CategoryIcon size={30} color={colors.primary} strokeWidth={1.5} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{productText(item.title, i18n.language)}</Text>

                    <Text style={styles.cardSeller} numberOfLines={1}>
                      {t('customer.byArtisan', { name: item.seller.name })}
                    </Text>
                    <Text style={styles.cardPrice}>₹{item.price.toLocaleString('en-IN')}</Text>
                  </View>
                </AnimatedPressable>
              </Animated.View>
            );
          }}
        />
      ) : null}
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
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.round,
    backgroundColor: colors.primaryTint,
  },
  switchButtonText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.round,
    backgroundColor: colors.primaryTint,
  },
  mapContainer: {
    flex: 1,
  },
  mapPermissionNote: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: Spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  mapEmptyBanner: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  mapEmptyText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: 14,
    minHeight: TouchTarget.minHeight,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: colors.textPrimary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.round,
    backgroundColor: colors.primaryTint,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  chipTextActive: {
    color: colors.textOnPrimary,
  },
  resultsCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textMuted,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 4,
  },
  listContainer: {
    padding: Spacing.lg,
    paddingBottom: 80,
    gap: Spacing.md,
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  cardImage: {
    width: '100%',
    height: 130,
  },
  cardImagePlaceholder: {
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    minHeight: 30,
  },
  cardTitleNative: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  cardSeller: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginTop: 4,
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
