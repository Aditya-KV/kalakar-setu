import React from 'react';
import { Text, View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface IconCardProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  index?: number;
}

export const IconCard: React.FC<IconCardProps> = ({
  icon,
  title,
  subtitle,
  selected = false,
  onPress,
  style,
  index = 0,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(320)}>
      <AnimatedPressable
        onPress={onPress}
        style={[styles.card, selected && styles.selectedCard, style]}
      >
        <View style={styles.content}>
          {icon && (
            <View style={[styles.iconContainer, selected && styles.selectedIconContainer]}>
              {icon}
            </View>
          )}

          <View style={styles.textContainer}>
            <Text style={[styles.title, selected && styles.selectedTitle]}>
              {title}
            </Text>
            {subtitle && (
              <Text style={[styles.subtitle, selected && styles.selectedSubtitle]}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {selected && (
          <Animated.View entering={ZoomIn.duration(220)} style={styles.checkBadge}>
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </Animated.View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: BorderRadius.lg,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    ...Shadows.card,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconContainer: {
    backgroundColor: colors.primaryTint,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  selectedTitle: {
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectedSubtitle: {
    color: colors.textPrimary,
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
