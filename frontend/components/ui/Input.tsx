import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { TouchTarget, BorderRadius, FontSize, FontWeight } from '../../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  prefix,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.focusedWrapper,
          !!error && styles.errorWrapper,
        ]}
      >
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}

        <TextInput
          accessibilityLabel={label}
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>

      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.minHeight,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
  },
  focusedWrapper: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  errorWrapper: {
    borderColor: colors.error,
  },
  prefix: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },
});
