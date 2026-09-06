import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { User, Camera, Check, Clock, MapPin, Sun, Moon, MonitorSmartphone, ArrowLeftRight } from 'lucide-react-native';
import { useAuth } from '../../../features/auth/hooks';
import { useTheme } from '../../../features/theme/context';
import { useAppMode } from '../../../features/appMode/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { AnimatedPressable } from '../../../components/ui/AnimatedPressable';
import { apiClient } from '../../../lib/api-client';
import { SellerReadiness } from '../../../types';

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const { setMode: setAppMode } = useAppMode();
  const styles = getStyles(colors);

  const handleSwitchToBuying = () => {
    setAppMode('customer');
    router.replace('/(app)/(customer-tabs)');
  };

  const THEME_OPTIONS = [
    { key: 'light' as const, label: t('profile.themeLight'), Icon: Sun },
    { key: 'dark' as const, label: t('profile.themeDark'), Icon: Moon },
    { key: 'system' as const, label: t('profile.themeSystem'), Icon: MonitorSmartphone },
  ];

  const [readiness, setReadiness] = useState<SellerReadiness | null>(null);

  useEffect(() => {
    const fetchReadiness = async () => {
      try {
        const res = await apiClient.get('/profile/readiness');
        setReadiness(res.data);
      } catch (e) {
        // Fallback default
      }
    };
    fetchReadiness();
  }, []);

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

  const checklist = [
    { label: t('profile.profileComplete'), done: true },
    { label: t('profile.craftSelected'), done: true },
    { label: t('profile.locationSelected'), done: true },
    { label: t('profile.gemConnected'), done: false },
    { label: t('profile.ondcConnected'), done: false },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>{t('profile.headerTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Header Avatar */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.profileHeader}>
          <Animated.View entering={ZoomIn.delay(80).duration(400)} style={styles.avatarWrapper}>
            <User size={44} color={colors.primary} strokeWidth={1.8} />
            <AnimatedPressable style={styles.cameraBadge}>
              <Camera size={14} color="#FFFFFF" strokeWidth={2} />
            </AnimatedPressable>
          </Animated.View>

          <Text style={styles.artisanName}>{user?.display_name || 'Ramesh Kumar'}</Text>
          <Text style={styles.craftTag}>
            {user?.craft_types?.join(' • ') || 'Pottery & Ceramics'}
          </Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.textSecondary} strokeWidth={2} />
            <Text style={styles.locationTag}>
              {user?.district_code || 'Jaipur'}, {user?.state_code || 'Rajasthan'}
            </Text>
          </View>
        </Animated.View>

        {/* Readiness Checklist Card */}
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <Text style={styles.readinessTitle}>{t('dashboard.readinessTitle')}</Text>
            <Text style={styles.readinessPercent}>
              {readiness?.completion_percentage ?? 100}%
            </Text>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${readiness?.completion_percentage ?? 100}%` },
              ]}
            />
          </View>

          <View style={styles.checklistGroup}>
            {checklist.map((item, index) => (
              <Animated.View
                key={item.label}
                entering={FadeInDown.delay(200 + index * 60).duration(260)}
                style={styles.checkItem}
              >
                {item.done ? (
                  <Check size={14} color={colors.success} strokeWidth={3} />
                ) : (
                  <Clock size={14} color={colors.textMuted} strokeWidth={2} />
                )}
                <Text style={item.done ? styles.checkText : styles.checkTextPending}>
                  {item.label}
                </Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Switch to Customer/Buying mode */}
        <Animated.View entering={FadeInDown.delay(150).duration(320)}>
          <AnimatedPressable style={styles.switchCard} onPress={handleSwitchToBuying}>
            <ArrowLeftRight size={18} color={colors.primary} strokeWidth={2} />
            <Text style={styles.switchCardText}>{t('customer.switchToBuying')}</Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Appearance / Theme Selector */}
        <Animated.View entering={FadeInDown.delay(170).duration(320)} style={styles.appearanceCard}>
          <Text style={styles.readinessTitle}>{t('profile.appearance')}</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map((opt) => {
              const selected = mode === opt.key;
              return (
                <AnimatedPressable
                  key={opt.key}
                  style={[styles.themeOption, selected && styles.themeOptionSelected]}
                  onPress={() => setMode(opt.key)}
                >
                  <opt.Icon size={18} color={selected ? colors.primary : colors.textSecondary} strokeWidth={2} />
                  <Text style={selected ? styles.themeOptionTextSelected : styles.themeOptionText}>
                    {opt.label}
                  </Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Story & Artisan Bio */}
        <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.storyCard}>
          <Text style={styles.storyTitle}>{t('profile.storyTitle')}</Text>
          <Text style={styles.storyBody}>"{t('profile.storyBody')}"</Text>
        </Animated.View>

        {/* Actions */}
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: Spacing.sm,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  artisanName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  craftTag: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.primary,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationTag: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
  },
  readinessCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  readinessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  readinessTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  readinessPercent: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.success,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  checklistGroup: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkText: {
    fontSize: FontSize.xs,
    color: colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  checkTextPending: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
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
  appearanceCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
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
  storyCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  storyTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  storyBody: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionGroup: {
    marginTop: Spacing.sm,
  },
});
