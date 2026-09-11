import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, DimensionValue } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../features/theme/context';
import { Spacing, BorderRadius } from '../../constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** A single pulsing placeholder block — the building block for every skeleton below. */
export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 14, borderRadius = 6, style }) => {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.5);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: colors.border }, animatedStyle, style]} />
  );
};

/** Mirrors a Discover product card while its real content loads. */
export const ProductCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton height={130} borderRadius={0} />
      <View style={styles.productCardBody}>
        <Skeleton height={11} width="90%" />
        <Skeleton height={11} width="55%" />
        <Skeleton height={14} width="40%" style={{ marginTop: 4 }} />
      </View>
    </View>
  );
};

/** A 2-column grid of ProductCardSkeletons, matching Discover's FlatList layout. */
export const ProductGridSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <View style={styles.grid}>
    {Array.from({ length: rows }).map((_, row) => (
      <View key={row} style={styles.gridRow}>
        <ProductCardSkeleton />
        <ProductCardSkeleton />
      </View>
    ))}
  </View>
);

/** Mirrors the seller Home "Business Overview" card while stats load. */
export const OverviewCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton height={13} width="50%" />
      <View style={[styles.statsGrid, { marginTop: Spacing.md }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={10} width="60%" />
          <Skeleton height={22} width="45%" />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={10} width="60%" />
          <Skeleton height={22} width="30%" />
        </View>
      </View>
    </View>
  );
};

/** Mirrors an order card (header + one product row) while orders load. */
export const OrderCardSkeleton: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.orderHeaderRow}>
        <Skeleton height={14} width="40%" />
        <Skeleton height={14} width="20%" />
      </View>
      <Skeleton height={10} width="55%" style={{ marginTop: 10 }} />
      <View style={styles.orderProductRow}>
        <Skeleton width={48} height={48} borderRadius={BorderRadius.md} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={11} width="80%" />
          <Skeleton height={11} width="30%" />
        </View>
      </View>
    </View>
  );
};

export const OrderListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
    {Array.from({ length: count }).map((_, i) => <OrderCardSkeleton key={i} />)}
  </View>
);

const styles = StyleSheet.create({
  grid: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  productCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productCardBody: {
    padding: Spacing.sm,
    gap: 6,
  },
  overviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  orderCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
  },
  orderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
