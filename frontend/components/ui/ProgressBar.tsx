import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { BorderRadius, FontSize, FontWeight } from '../../constants/theme';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  showLabel = true,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const percentage = Math.min(Math.max((currentStep / totalSteps) * 100, 0), 100);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(percentage, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [percentage]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.stepText}>
            Step {currentStep} of {totalSteps}
          </Text>
          <Text style={styles.percentText}>{Math.round(percentage)}%</Text>
        </View>
      )}

      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stepText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
  },
  percentText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.round,
  },
});
