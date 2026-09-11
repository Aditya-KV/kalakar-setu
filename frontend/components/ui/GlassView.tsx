import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../features/theme/context';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}

export function GlassView({ children, style, intensity = 45 }: GlassViewProps) {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';

  return (
    <BlurView intensity={intensity} tint={dark ? 'dark' : 'light'} style={style}>
      <LinearGradient
        pointerEvents="none"
        colors={
          dark
            ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']
            : ['rgba(255,255,255,0.60)', 'rgba(255,255,255,0.22)']
        }
        style={StyleSheet.absoluteFill}
      />
      {children}
    </BlurView>
  );
}
