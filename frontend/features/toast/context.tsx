import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme } from '../theme/context';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../constants/theme';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextType {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);
const AUTO_DISMISS_MS = 2400;

/**
 * A lightweight, non-blocking replacement for Alert.alert() on one-way
 * confirmations ("Added to cart", "Published!") — mounted at the root so
 * it survives the navigation that often immediately follows (e.g.
 * publish-then-redirect), unlike a dialog tied to the screen it appears
 * on. Reserve Alert.alert for anything that genuinely needs a user
 * decision (Cancel/Confirm).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, variant });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  };

  const backgroundColor = toast?.variant === 'error'
    ? colors.error
    : toast?.variant === 'info'
    ? colors.secondary
    : colors.primary;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={styles.overlay}>
          <Animated.View
            key={toast.id}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutDown.duration(200)}
            style={[styles.toast, { backgroundColor }]}
          >
            <AnimatedPressable onPress={dismiss} style={styles.pressable} accessibilityRole="alert">
              <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 110,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  pressable: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  text: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
});
