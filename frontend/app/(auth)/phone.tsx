import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/hooks';
import { useAppMode } from '../../features/appMode/context';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontSize, FontWeight, Spacing } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { FirebasePhoneSignIn } from '../../components/auth/FirebasePhoneSignIn';

export default function PhoneScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { verifyFirebasePhone, devBypassLogin } = useAuth();
  const { mode } = useAppMode();
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const goToNextScreen = (isNewUser?: boolean) => {
    if (isNewUser) {
      router.replace('/(auth)/consent');
    } else {
      router.replace(mode === 'customer' ? '/(app)/(customer-tabs)' : '/(app)/(tabs)');
    }
  };

  const handleVerified = async (idToken: string) => {
    setError('');
    setVerifying(true);
    const res = await verifyFirebasePhone(idToken);
    setVerifying(false);

    if (res.success) {
      goToNextScreen(res.is_new_user);
    } else {
      setError(res.message || t('auth.verificationFailed'));
    }
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const handleDevBypass = async () => {
    setError('');
    setVerifying(true);
    const res = await devBypassLogin();
    setVerifying(false);

    if (res.success) {
      goToNextScreen(res.is_new_user);
    } else {
      setError(res.message || 'Dev bypass failed.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.topSection}>
            <Text style={styles.title}>{t('auth.signInWithPhone')}</Text>
            <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {verifying ? (
            <Text style={styles.verifyingText}>{t('auth.verifying')}</Text>
          ) : (
            <FirebasePhoneSignIn onVerified={handleVerified} onError={handleError} />
          )}

          {__DEV__ && (
            <Button
              title="Skip sign-in (Dev only)"
              variant="outline"
              onPress={handleDevBypass}
              style={styles.devButton}
            />
          )}

          <View style={styles.footer}>
            <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
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
  errorText: {
    fontSize: FontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  verifyingText: {
    fontSize: FontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  footer: {
    padding: Spacing.md,
    marginTop: 'auto',
  },
  devButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
});
