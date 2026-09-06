import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { signInWithPhoneNumber, ConfirmationResult } from '@react-native-firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontWeight, Spacing } from '../../constants/theme';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface FirebasePhoneSignInProps {
  onVerified: (idToken: string) => void;
  onError: (message: string) => void;
}

/**
 * Native Firebase Phone Authentication. On Android this uses Play Integrity
 * for app verification instead of reCAPTCHA — no WebView, no captcha UI, and
 * none of the reCAPTCHA-in-WebView bugs the JS SDK approach hit.
 */
export const FirebasePhoneSignIn: React.FC<FirebasePhoneSignInProps> = ({ onVerified, onError }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const handleSendCode = async () => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length !== 10) return;

    setSending(true);
    try {
      const result = await signInWithPhoneNumber(firebaseAuth, `+91${cleanPhone}`);
      setConfirmation(result);
    } catch (err: any) {
      onError(err?.message || 'Could not send the verification code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmation || code.length !== 6) return;

    setVerifying(true);
    try {
      const credential = await confirmation.confirm(code);
      const idToken = await credential.user.getIdToken();
      onVerified(idToken);
    } catch (err: any) {
      onError(err?.message || 'Invalid code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      {!confirmation ? (
        <>
          <Input
            label="Mobile Number"
            prefix="+91"
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
          <Button
            title="Send Code"
            onPress={handleSendCode}
            loading={sending}
            disabled={phone.length < 10}
            style={styles.button}
          />
        </>
      ) : (
        <>
          <Text style={styles.codeSentText}>
            Enter the 6-digit code sent to <Text style={styles.phoneHighlight}>+91 {phone}</Text>
          </Text>
          <Input
            label="Verification Code"
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <Button
            title="Verify"
            onPress={handleVerifyCode}
            loading={verifying}
            disabled={code.length < 6}
            style={styles.button}
          />
        </>
      )}
    </View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
  },
  codeSentText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  phoneHighlight: {
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
});
