import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Text, ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Compass, ShoppingCart, Receipt, User } from 'lucide-react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../features/theme/context';
import { useCart } from '../../../features/cart/context';
import { GlassView } from '../../../components/ui/GlassView';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight } from '../../../constants/theme';

function CartIcon({ color, size }: { color: ColorValue; size: number }) {
  const { totalItems } = useCart();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (totalItems > 0) {
      scale.value = withSequence(withTiming(1.4, { duration: 120 }), withSpring(1, { damping: 7 }));
    }
  }, [totalItems]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View>
      <ShoppingCart color={color as string} size={size} />
      {totalItems > 0 && (
        <Animated.View style={[styles.badge, badgeStyle]}>
          <Text style={styles.badgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function CustomerTabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarBackground: () => <GlassView style={StyleSheet.absoluteFill} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('customer.tabDiscover'),
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('customer.tabCart'),
          tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('customer.tabOrders'),
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 0,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
});
