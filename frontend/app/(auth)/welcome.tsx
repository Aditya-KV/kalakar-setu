import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Volume2, Hammer, ShoppingBag, Check } from 'lucide-react-native';
import { useAuth } from '../../features/auth/hooks';
import { useAppMode, AppMode } from '../../features/appMode/context';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LanguagePicker } from '../../components/ui/LanguagePicker';
import { LogoBadge } from '../../components/ui/LogoBadge';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { MeshGradientBackground } from '../../components/ui/MeshGradientBackground';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { language, setLanguage } = useAuth();
  const { mode, setMode } = useAppMode();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
  };

  const handleSelectRole = (role: AppMode) => {
    setMode(role);
  };

  const handleContinue = () => {
    router.push('/(auth)/phone');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <MeshGradientBackground />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.heroSection}>
          <Animated.View entering={ZoomIn.duration(450)}>
            <LogoBadge size={72} />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(350)}>
            <Text style={styles.title}>{t('welcome.title')}</Text>
            <Text style={styles.tagline}>{t('common.tagline')}</Text>
            <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
          </Animated.View>
        </View>

        {/* Language Grid */}
        <View style={styles.pickerSection}>
          <LanguagePicker selectedCode={language} onSelect={handleSelectLanguage} />
        </View>

        {/* Seller / Buyer role selection */}
        <Animated.View entering={FadeInDown.delay(250).duration(350)} style={styles.roleSection}>
          <Text style={styles.roleTitle}>{t('welcome.roleTitle')}</Text>
          <View style={styles.roleRow}>
            <AnimatedPressable
              style={[styles.roleCard, mode === 'seller' && styles.roleCardActive]}
              onPress={() => handleSelectRole('seller')}
            >
              {mode === 'seller' && (
                <View style={styles.roleCheckBadge}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
              <View style={[styles.roleIconWrap, mode === 'seller' && styles.roleIconWrapActive]}>
                <Hammer size={22} color={mode === 'seller' ? colors.primary : colors.textMuted} strokeWidth={2} />
              </View>
              <Text style={[styles.roleCardTitle, mode === 'seller' && styles.roleCardTitleActive]}>
                {t('welcome.roleSeller')}
              </Text>
              <Text style={styles.roleCardSub}>{t('welcome.roleSellerSub')}</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.roleCard, mode === 'customer' && styles.roleCardActive]}
              onPress={() => handleSelectRole('customer')}
            >
              {mode === 'customer' && (
                <View style={styles.roleCheckBadge}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
              <View style={[styles.roleIconWrap, mode === 'customer' && styles.roleIconWrapActive]}>
                <ShoppingBag size={22} color={mode === 'customer' ? colors.primary : colors.textMuted} strokeWidth={2} />
              </View>
              <Text style={[styles.roleCardTitle, mode === 'customer' && styles.roleCardTitleActive]}>
                {t('welcome.roleBuyer')}
              </Text>
              <Text style={styles.roleCardSub}>{t('welcome.roleBuyerSub')}</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        {/* Voice orientation hint */}
        <Animated.View entering={FadeInDown.delay(400).duration(350)} style={styles.voiceCard}>
          <Volume2 size={20} color={colors.primary} strokeWidth={2} />
          <Text style={styles.voiceText}>{t('welcome.voicePrompt')}</Text>
        </Animated.View>
      </ScrollView>

      {/* CTA Button — fixed outside the ScrollView so it's always visible,
          never hidden below the fold behind the scrolling language list. */}
      <View style={styles.footer}>
        <Button
          title={t('welcome.getStarted')}
          onPress={handleContinue}
          size="large"
        />
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
    padding: Spacing.lg,
    flexGrow: 1,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tagline: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.primary,
    marginTop: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  pickerSection: {
    marginVertical: Spacing.sm,
  },
  roleSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roleTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  roleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  roleIconWrapActive: {
    backgroundColor: colors.primaryTint,
  },
  roleCardTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  roleCardTitleActive: {
    color: colors.primaryDark,
  },
  roleCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleCheckBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  voiceText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  footer: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
