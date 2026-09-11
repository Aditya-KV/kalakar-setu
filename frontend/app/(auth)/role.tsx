import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Hammer, ShoppingBag, Check } from 'lucide-react-native';
import { useAppMode, AppMode } from '../../features/appMode/context';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { MeshGradientBackground } from '../../components/ui/MeshGradientBackground';

export default function RoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { mode, setMode } = useAppMode();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleSelectRole = (role: AppMode) => {
    setMode(role);
  };

  const handleContinue = () => {
    router.push('/(auth)/phone');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <MeshGradientBackground />
      <View style={styles.container}>
        <View style={styles.header}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.iconCircle}>
            <Hammer size={32} color={colors.primary} strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>{t('welcome.roleTitle')}</Text>
          <Text style={styles.subtitle}>{t('welcome.roleSubtitle')}</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(350)} style={styles.roleColumn}>
          <AnimatedPressable
            style={[styles.roleCard, mode === 'seller' && styles.roleCardActive]}
            onPress={() => handleSelectRole('seller')}
          >
            {mode === 'seller' && (
              <View style={styles.roleCheckBadge}>
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
            <View style={[styles.roleIconWrap, mode === 'seller' && styles.roleIconWrapActive]}>
              <Hammer size={28} color={mode === 'seller' ? colors.primary : colors.textMuted} strokeWidth={2} />
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
                <Check size={14} color="#FFFFFF" strokeWidth={3} />
              </View>
            )}
            <View style={[styles.roleIconWrap, mode === 'customer' && styles.roleIconWrapActive]}>
              <ShoppingBag size={28} color={mode === 'customer' ? colors.primary : colors.textMuted} strokeWidth={2} />
            </View>
            <Text style={[styles.roleCardTitle, mode === 'customer' && styles.roleCardTitleActive]}>
              {t('welcome.roleBuyer')}
            </Text>
            <Text style={styles.roleCardSub}>{t('welcome.roleBuyerSub')}</Text>
          </AnimatedPressable>
        </Animated.View>

        <View style={styles.footer}>
          <Button title={t('common.continue')} onPress={handleContinue} size="large" />
          <Button
            title={t('common.back')}
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.sm }}
          />
        </View>
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
  header: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
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
  },
  roleColumn: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  roleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  roleIconWrapActive: {
    backgroundColor: colors.primaryTint,
  },
  roleCardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  roleCardTitleActive: {
    color: colors.primaryDark,
  },
  roleCardSub: {
    fontSize: FontSize.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  roleCheckBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
