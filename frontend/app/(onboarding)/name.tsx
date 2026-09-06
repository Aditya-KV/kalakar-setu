import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { User, Mic } from 'lucide-react-native';
import { useAuth } from '../../features/auth/hooks';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function OnboardingNameScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateOnboardingStep } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [name, setName] = useState(user?.display_name || '');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    setLoading(true);
    await updateOnboardingStep(1, { display_name: name.trim() });
    setLoading(false);
    router.push('/(onboarding)/craft');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topSection}>
            <ProgressBar currentStep={1} totalSteps={3} />

            <Animated.View entering={ZoomIn.duration(400)} style={styles.iconCircle}>
              <User size={30} color={colors.primary} strokeWidth={2} />
            </Animated.View>

            <Text style={styles.title}>{t('onboarding.step1Title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.step1Subtitle')}</Text>
          </View>

          <Animated.View entering={FadeInDown.delay(150).duration(320)} style={styles.inputSection}>
            <Input
              label={t('onboarding.step1Title')}
              placeholder={t('onboarding.namePlaceholder')}
              value={name}
              onChangeText={setName}
              autoFocus
            />

            <View style={styles.voiceHint}>
              <Mic size={18} color={colors.textSecondary} strokeWidth={2} />
              <Text style={styles.hintText}>
                {t('onboarding.voiceHint', 'You can also record your name with voice in later steps')}
              </Text>
            </View>
          </Animated.View>

          <View style={styles.footer}>
            <Button
              title={t('common.continue')}
              onPress={handleNext}
              loading={loading}
              disabled={!name.trim()}
              size="large"
            />
            <Button
              title={t('common.skip')}
              variant="ghost"
              onPress={() => router.push('/(onboarding)/craft')}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
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
  },
  inputSection: {
    marginVertical: Spacing.xl,
  },
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    gap: 10,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
