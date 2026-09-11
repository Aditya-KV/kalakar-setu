import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useFonts, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { useTheme } from '../../features/theme/context';
import { FontSize } from '../../constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A hand-authored decorative pen flourish (not literal letterforms) that
// draws itself under the text, like a signature underline swoosh —
// generously oversized strokeDasharray so the exact path length doesn't
// need to be measured precisely for the draw-on reveal to look clean.
const FLOURISH_PATH = 'M4,16 C 26,-4 46,34 70,14 C 88,-2 104,18 124,10 C 140,4 156,14 172,8';
const FLOURISH_DASH = 400;

interface SignatureGreetingProps {
  text: string;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

/**
 * A "signature reveal" greeting — the flourish underline draws itself on
 * (SVG stroke-dashoffset animation), then the text fades up right after,
 * like a pen finishing a signature. Plays once on mount.
 */
export const SignatureGreeting: React.FC<SignatureGreetingProps> = ({ text, style, textColor }) => {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({ DancingScript_700Bold });
  const drawProgress = useSharedValue(0);
  const textReveal = useSharedValue(0);

  useEffect(() => {
    if (!fontsLoaded) return;
    drawProgress.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.cubic) });
    textReveal.value = withDelay(450, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontsLoaded]);

  const flourishProps = useAnimatedProps(() => ({
    strokeDashoffset: FLOURISH_DASH * (1 - drawProgress.value),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textReveal.value,
    transform: [{ translateY: (1 - textReveal.value) * 8 }],
  }));

  if (!fontsLoaded) {
    // Avoid a layout jump once the font pops in — reserve the space with
    // an invisible placeholder at the same size.
    return <View style={[styles.container, style]}><Text style={styles.placeholder}>{text}</Text></View>;
  }

  return (
    <View style={[styles.container, style]}>
      <Animated.Text
        style={[styles.text, { color: textColor || colors.textPrimary }, textStyle]}
      >
        {text}
      </Animated.Text>
      <Svg width={176} height={22} viewBox="0 0 176 22" style={styles.flourish}>
        <AnimatedPath
          d={FLOURISH_PATH}
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={FLOURISH_DASH}
          animatedProps={flourishProps}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  text: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: FontSize.xxl + 6,
    lineHeight: FontSize.xxl + 10,
  },
  placeholder: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    opacity: 0,
  },
  flourish: {
    marginTop: -4,
    marginLeft: 2,
  },
});
