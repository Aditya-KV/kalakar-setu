import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Sparkles, TriangleAlert } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { BorderRadius, FontSize, FontWeight } from '../../constants/theme';

interface QualityAlertProps {
  score: number;
  issues: string[];
}

export const QualityAlert: React.FC<QualityAlertProps> = ({ score, issues }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (issues.length === 0 && score >= 0.8) {
    return (
      <Animated.View
        entering={FadeInDown.duration(320)}
        style={[styles.container, styles.goodContainer]}
      >
        <Sparkles size={22} color={colors.success} strokeWidth={2} />
        <View style={styles.textGroup}>
          <Text style={styles.goodTitle}>{t('studio.qualityGoodTitle')}</Text>
          <Text style={styles.goodSub}>{t('studio.qualityGoodSub')}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={[styles.container, styles.warningContainer]}
    >
      <TriangleAlert size={22} color={colors.warning} strokeWidth={2} />
      <View style={styles.textGroup}>
        <Text style={styles.warningTitle}>{t('studio.qualityWarningTitle')}</Text>
        {issues.map((issue, idx) => (
          <Text key={idx} style={styles.issueText}>
            • {issue}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.md,
    marginVertical: 10,
    gap: 12,
    borderWidth: 1,
  },
  goodContainer: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  warningContainer: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  textGroup: {
    flex: 1,
  },
  goodTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.success,
  },
  goodSub: {
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 2,
  },
  warningTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.warning,
  },
  issueText: {
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 2,
  },
});
