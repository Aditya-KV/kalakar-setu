import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../features/theme/context';
import { Button } from './Button';

export function RequestFeedback({ loading, error, onRetry }: {
  loading?: boolean; error?: string | null; onRetry?: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (!loading && !error) return null;
  return (
    <View style={{ padding: 16, gap: 12, alignItems: 'center' }} accessibilityLiveRegion="polite">
      {loading ? <>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
      </> : <>
        <Text accessibilityRole="alert" style={{ color: colors.error, textAlign: 'center' }}>{error}</Text>
        {onRetry && <Button title={t('common.retry')} onPress={onRetry} />}
      </>}
    </View>
  );
}
