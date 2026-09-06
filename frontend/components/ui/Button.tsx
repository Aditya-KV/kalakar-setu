import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { TouchTarget, BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'normal' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'normal',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';

  const minHeight = size === 'large' ? 62 : TouchTarget.minHeight;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withSpring(0.96, { duration: 220, dampingRatio: 1 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { duration: 220, dampingRatio: 1 });
  };

  if (isPrimary && !disabled) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        style={[{ minHeight }, styles.shadow, style]}
      >
        <AnimatedLinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, { minHeight }, styles.primaryGradient, animatedStyle]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              {icon}
              <Text style={[styles.textPrimary, textStyle]}>{title}</Text>
            </>
          )}
        </AnimatedLinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.base,
          { minHeight },
          isSecondary && styles.secondary,
          isOutline && styles.outline,
          variant === 'ghost' && styles.ghost,
          disabled && styles.disabled,
          style,
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={isOutline ? colors.primary : '#FFFFFF'}
            size="small"
          />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.textBase,
                isSecondary && styles.textSecondary,
                isOutline && styles.textOutline,
                variant === 'ghost' && styles.textGhost,
                disabled && styles.textDisabled,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  shadow: Shadows.button,
  primaryGradient: {
    borderRadius: BorderRadius.lg,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  textPrimary: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  textBase: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  textSecondary: {
    color: colors.textOnSecondary,
  },
  textOutline: {
    color: colors.primary,
  },
  textGhost: {
    color: colors.secondary,
  },
  textDisabled: {
    color: colors.textMuted,
  },
});
