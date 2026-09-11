import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, ZoomIn, FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { LogoBadge } from '../../components/ui/LogoBadge';
import { MeshGradientBackground } from '../../components/ui/MeshGradientBackground';

export default function LandingScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.safeArea}>
      <MeshGradientBackground />

      {/* Soft decorative color fields, Headspace-style — pure shapes, no assets needed */}
      <View pointerEvents="none" style={styles.blobLayer}>
        <Animated.View
          entering={FadeIn.duration(900)}
          style={[styles.blob, styles.blobPrimary]}
        />
        <Animated.View
          entering={FadeIn.delay(150).duration(900)}
          style={[styles.blob, styles.blobAccent]}
        />
        <Animated.View
          entering={FadeIn.delay(300).duration(900)}
          style={[styles.blob, styles.blobSmall]}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.top} />

        <View style={styles.center}>
          <Animated.View entering={ZoomIn.duration(500)}>
            <LogoBadge size={104} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.textBlock}>
            <Text style={styles.headline}>{t('landing.headline')}</Text>
            <Text style={styles.subtitle}>{t('landing.subtitle')}</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footer}>
          <Button
            title={t('landing.cta')}
            onPress={() => router.push('/(auth)/scenes')}
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
  blobLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobPrimary: {
    width: 280,
    height: 280,
    top: -80,
    right: -90,
    backgroundColor: colors.primaryTint,
  },
  blobAccent: {
    width: 220,
    height: 220,
    bottom: -60,
    left: -80,
    backgroundColor: colors.surfaceElevated,
  },
  blobSmall: {
    width: 90,
    height: 90,
    top: '38%',
    left: -30,
    backgroundColor: colors.primaryTint,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  top: {
    height: Spacing.xl,
  },
  center: {
    alignItems: 'center',
  },
  textBlock: {
    marginTop: Spacing.xl,
  },
  headline: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 40,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  footer: {
    marginBottom: Spacing.md,
  },
});
