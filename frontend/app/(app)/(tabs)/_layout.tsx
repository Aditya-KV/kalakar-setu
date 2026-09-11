import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Home, Package, Truck, User } from 'lucide-react-native';
import { useTheme } from '../../../features/theme/context';
import { GlassView } from '../../../components/ui/GlassView';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight } from '../../../constants/theme';

export default function TabsLayout() {
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
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: t('tabs.products'),
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
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
});
