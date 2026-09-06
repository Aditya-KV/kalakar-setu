import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/hooks';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { CraftPicker } from '../../components/ui/CraftPicker';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function OnboardingCraftScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateOnboardingStep } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [selectedCrafts, setSelectedCrafts] = useState<string[]>(
    user?.craft_types || ['pottery']
  );
  const [loading, setLoading] = useState(false);

  const handleToggleCraft = (id: string) => {
    setSelectedCrafts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleNext = async () => {
    setLoading(true);
    await updateOnboardingStep(2, { craft_types: selectedCrafts });
    setLoading(false);
    router.push('/(onboarding)/location');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topSection}>
          <ProgressBar currentStep={2} totalSteps={3} />

          <Text style={styles.title}>{t('onboarding.step2Title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step2Subtitle')}</Text>
        </View>

        <View style={styles.pickerSection}>
          <CraftPicker selectedIds={selectedCrafts} onToggle={handleToggleCraft} />
        </View>

        <View style={styles.footer}>
          <Button
            title={t('common.continue')}
            onPress={handleNext}
            loading={loading}
            disabled={selectedCrafts.length === 0}
            size="large"
          />
          <Button
            title={t('common.back')}
            variant="ghost"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.sm }}
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
  container: {
    padding: Spacing.lg,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  pickerSection: {
    marginVertical: Spacing.md,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
