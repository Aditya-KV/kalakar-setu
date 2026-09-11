import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn, FadeIn } from 'react-native-reanimated';
import { PartyPopper } from 'lucide-react-native';
import { useAuth } from '../../features/auth/hooks';
import { useAppMode } from '../../features/appMode/context';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Button } from '../../components/ui/Button';

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { mode } = useAppMode();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleGoToApp = () => {
    router.replace(mode === 'customer' ? '/(app)/(customer-tabs)' : '/(app)/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Animated.View
            entering={ZoomIn.duration(500)}
            style={styles.badgeCircle}
          >
            <PartyPopper size={48} color={colors.primary} strokeWidth={2} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(350)}>
            <Text style={styles.title}>{t('onboarding.completeTitle')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.completeSubtitle')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350).duration(350)} style={styles.summaryCard}>
            <Text style={styles.cardHeader}>{t('onboarding.summaryTitle')}</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('onboarding.summaryName')}:</Text>
              <Text style={styles.rowValue}>{user?.display_name || 'Ramesh Kumar'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('onboarding.summaryCrafts')}:</Text>
              <Text style={styles.rowValue}>
                {user?.craft_types?.join(', ') || 'Pottery'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('onboarding.summaryLocation')}:</Text>
              <Text style={styles.rowValue}>
                {user?.district_code || 'Jaipur'}, {user?.state_code || 'Rajasthan'}
              </Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(500).duration(350)} style={styles.footer}>
          <Button
            title={t('onboarding.startCreating')}
            onPress={handleGoToApp}
            size="large"
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  badgeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    lineHeight: 22,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  cardHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.primary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
  },
  rowValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
