import React from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import Svg, { Defs, Rect, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../features/theme/context';

interface MeshGradientBackgroundProps {
  style?: ViewStyle;
}

/**
 * A soft, feathered mesh-gradient backdrop — several overlapping radial
 * color pools (no hard circle edges) blended over the app's warm base
 * color, in the spirit of feralui.dev/gradients' mesh gradients. Built
 * with SVG radial gradients rather than flat shapes so the color pools
 * actually blend into the background instead of reading as circles.
 */
export const MeshGradientBackground: React.FC<MeshGradientBackgroundProps> = ({ style }) => {
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isDark = scheme === 'dark';

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="poolMaroon" cx="82%" cy="6%" r="65%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={isDark ? 0.32 : 0.22} />
            <Stop offset="55%" stopColor={colors.primary} stopOpacity={isDark ? 0.14 : 0.09} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="poolGold" cx="8%" cy="96%" r="70%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={isDark ? 0.3 : 0.24} />
            <Stop offset="55%" stopColor={colors.accent} stopOpacity={isDark ? 0.12 : 0.1} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="poolRose" cx="14%" cy="18%" r="45%">
            <Stop offset="0%" stopColor={colors.primaryLight} stopOpacity={isDark ? 0.22 : 0.16} />
            <Stop offset="100%" stopColor={colors.primaryLight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={colors.background} />
        <Rect x={0} y={0} width={width} height={height} fill="url(#poolRose)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#poolGold)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#poolMaroon)" />
      </Svg>
    </View>
  );
};
