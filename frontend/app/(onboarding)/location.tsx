import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { MapPin } from 'lucide-react-native';
import { useAuth } from '../../features/auth/hooks';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LocationPicker } from '../../components/ui/LocationPicker';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function OnboardingLocationScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, updateOnboardingStep } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [stateCode, setStateCode] = useState<string | null>(user?.state_code || 'RJ');
  const [districtCode, setDistrictCode] = useState<string | null>(user?.district_code || 'RJ-JAI');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (!stateCode || !districtCode) return;
    setLoading(true);
    await updateOnboardingStep(
      3,
      {
        state_code: stateCode,
        district_code: districtCode,
      },
      true // Mark onboarding completed!
    );
    setLoading(false);
    router.replace('/(onboarding)/complete');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topSection}>
          <ProgressBar currentStep={3} totalSteps={3} />

          <Animated.View entering={ZoomIn.duration(400)} style={styles.iconCircle}>
            <MapPin size={30} color={colors.primary} strokeWidth={2} />
          </Animated.View>

          <Text style={styles.title}>{t('onboarding.step3Title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step3Subtitle')}</Text>
        </View>

        <Animated.View entering={FadeInDown.delay(150).duration(320)} style={styles.pickerSection}>
          <LocationPicker
            selectedState={stateCode}
            selectedDistrict={districtCode}
            onSelectState={(s) => {
              setStateCode(s);
              setDistrictCode(null); // Reset district when state changes
            }}
            onSelectDistrict={(d) => setDistrictCode(d)}
          />
        </Animated.View>

        <View style={styles.footer}>
          <Button
            title={t('common.continue')}
            onPress={handleNext}
            loading={loading}
            disabled={!stateCode || !districtCode}
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
  pickerSection: {
    marginVertical: Spacing.xl,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
