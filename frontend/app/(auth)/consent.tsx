import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Shield, Lock, Camera, Handshake, Check } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { apiClient } from '../../lib/api-client';

const CONSENT_POINTS = [
  { key: 'point1', Icon: Lock },
  { key: 'point2', Icon: Camera },
  { key: 'point3', Icon: Handshake },
] as const;

export default function ConsentScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConsent = async () => {
    if (!agreed) return;
    setLoading(true);

    try {
      await apiClient.post('/profile/consent', {
        consent_type: 'privacy',
        policy_version: 'v2.0',
      });
    } catch (e) {
      // Ignored if offline — will sync
    } finally {
      setLoading(false);
      router.replace('/(onboarding)/name');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Animated.View entering={ZoomIn.duration(400)} style={styles.iconCircle}>
            <Shield size={32} color={colors.success} strokeWidth={2} />
          </Animated.View>
          <Text style={styles.title}>{t('consent.title')}</Text>
          <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>
        </View>

        <View style={styles.cardGroup}>
          {CONSENT_POINTS.map(({ key, Icon }, index) => (
            <Animated.View
              key={key}
              entering={FadeInDown.delay(150 + index * 90).duration(320)}
              style={styles.pointCard}
            >
              <View style={styles.pointIconCircle}>
                <Icon size={20} color={colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.pointText}>{t(`consent.${key}`)}</Text>
            </Animated.View>
          ))}
        </View>

        <AnimatedPressable
          style={styles.checkboxRow}
          onPress={() => setAgreed(!agreed)}
        >
          <View style={[styles.checkbox, agreed && styles.checkedBox]}>
            {agreed && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={styles.checkboxLabel}>{t('consent.agreeCheckbox')}</Text>
        </AnimatedPressable>

        <View style={styles.footer}>
          <Button
            title={t('consent.agreeButton')}
            onPress={handleConsent}
            loading={loading}
            disabled={!agreed}
            size="large"
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
  header: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.successLight,
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
  },
  cardGroup: {
    marginVertical: Spacing.lg,
    gap: 12,
  },
  pointCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  pointIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: 12,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkedBox: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.textPrimary,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
