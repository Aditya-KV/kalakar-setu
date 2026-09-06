import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../features/theme/context';
import { BorderRadius, FontSize, FontWeight } from '../../constants/theme';

interface StatusBadgeProps {
  status: 'draft' | 'synced' | 'action_required' | string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const { colors } = useTheme();
  const getBadgeStyle = () => {
    switch (status.toLowerCase()) {
      case 'synced':
      case 'live':
      case 'active':
        return {
          bg: colors.successLight,
          text: colors.success,
          dot: colors.success,
          defaultLabel: 'Synced',
        };
      case 'draft':
      case 'waiting':
        return {
          bg: colors.warningLight,
          text: colors.warning,
          dot: colors.warning,
          defaultLabel: 'Draft',
        };
      case 'action_required':
      case 'rejected':
      case 'error':
        return {
          bg: colors.errorLight,
          text: colors.error,
          dot: colors.error,
          defaultLabel: 'Action Required',
        };
      default:
        return {
          bg: colors.surfaceElevated,
          text: colors.textSecondary,
          dot: colors.textMuted,
          defaultLabel: status,
        };
    }
  };

  const badge = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
      <View style={[styles.dot, { backgroundColor: badge.dot }]} />
      <Text style={[styles.label, { color: badge.text }]}>
        {label || badge.defaultLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
