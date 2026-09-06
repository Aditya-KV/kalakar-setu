import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Volume2 } from 'lucide-react-native';
import { useAuth } from '../../features/auth/hooks';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LanguagePicker } from '../../components/ui/LanguagePicker';
import { LogoBadge } from '../../components/ui/LogoBadge';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { language, setLanguage } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleSelectLanguage = (code: string) => {
    setLanguage(code);
  };

  const handleContinue = () => {
    router.push('/(auth)/phone');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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
