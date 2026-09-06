import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { User, MapPin, ArrowLeftRight, Sun, Moon, MonitorSmartphone } from 'lucide-react-native';
import { useAuth } from '../../../features/auth/hooks';
import { useTheme } from '../../../features/theme/context';
import { useAppMode } from '../../../features/appMode/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { apiClient } from '../../../lib/api-client';

interface Address {
  id: string;
  label: string;
  line1: string;
  city: string;
  state_code: string;
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { colors, mode: themeMode, setMode: setThemeMode } = useTheme();
  const { setMode } = useAppMode();
  const styles = getStyles(colors);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const THEME_OPTIONS = [
    { key: 'light' as const, label: t('profile.themeLight'), Icon: Sun },
    { key: 'dark' as const, label: t('profile.themeDark'), Icon: Moon },
    { key: 'system' as const, label: t('profile.themeSystem'), Icon: MonitorSmartphone },
  ];

  useFocusEffect(
    useCallback(() => {
      apiClient.get('/addresses').then((res) => setAddresses(res.data)).catch(() => {});
    }, [])
  );

  const handleSwitchToSelling = () => {
    setMode('seller');
    router.replace('/(app)/(tabs)');
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.deactivateConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('profile.headerTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(320)} style={styles.profileHeader}>
          <Animated.View entering={ZoomIn.delay(80).duration(400)} style={styles.avatarWrapper}>
            <User size={44} color={colors.primary} strokeWidth={1.8} />
          </Animated.View>
          <Text style={styles.artisanName}>{user?.display_name || 'Guest'}</Text>
          <Text style={styles.phoneText}>{user?.phone_number}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <AnimatedPressable style={styles.switchCard} onPress={handleSwitchToSelling}>
            <ArrowLeftRight size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.switchCardText}>{t('customer.switchToSelling')}</Text>
          </AnimatedPressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(320)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('customer.myAddresses')}</Text>
          {addresses.length === 0 ? (
            <Text style={styles.emptyAddressText}>{t('customer.noAddressesYet')}</Text>
          ) : (
            addresses.map((addr) => (
              <View key={addr.id} style={styles.addressRow}>
                <MapPin size={13} color={colors.textSecondary} strokeWidth={2} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {addr.label}: {addr.line1}, {addr.city}, {addr.state_code}
                </Text>
              </View>
            ))
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(320)} style={styles.card}>
          <Text style={styles.cardTitle}>{t('profile.appearance')}</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const selected = themeMode === opt.key;
              return (
                <AnimatedPressable
                  key={opt.key}
                  style={[styles.themeOption, selected && styles.themeOptionSelected]}
                  onPress={() => setThemeMode(opt.key)}
                >
                  <opt.Icon size={18} color={selected ? colors.primary : colors.textSecondary} strokeWidth={2} />
                  <Text style={selected ? styles.themeOptionTextSelected : styles.themeOptionText}>{opt.label}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.actionGroup}>
          <Button
            title={t('profile.logout')}
            variant="outline"
            onPress={handleLogout}
            style={{ borderColor: colors.error }}
            textStyle={{ color: colors.error }}
          />
        </View>
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
  container: {
    padding: Spacing.lg,
    paddingBottom: 80,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  artisanName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  phoneText: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryTint,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  switchCardText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyAddressText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  addressText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  themeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  themeOptionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
  },
  themeOptionTextSelected: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  actionGroup: {
    marginTop: Spacing.sm,
  },
});
