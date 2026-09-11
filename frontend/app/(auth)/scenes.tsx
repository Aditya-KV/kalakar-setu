import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  useDerivedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
  FadeIn,
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { FontSize, FontWeight, Spacing, BorderRadius } from '../../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const LAST = 2; // 3 scenes: morning (0), midday (1), night (2)
const RIDGE_TOP = SCREEN_H * 0.42;
const DIAL_R = SCREEN_W * 0.42;
const DIAL_CY = SCREEN_H * 0.4;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Flat, palette-independent — the sun is gold and the moon is pale in any theme.
const SUN_COLOR = '#e8862e';
const MOON_COLOR = '#f6f3e2';
const NIGHT_BITE_COLOR = '#141a3a';

const PAGES = ['morning', 'midday', 'night'] as const;

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const twinkle = useSharedValue(0.45);
  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(0.95, { duration: 1400 }), withTiming(0.45, { duration: 1400 })), -1, true)
    );
  }, [delay, twinkle]);
  const style = useAnimatedStyle(() => ({ opacity: twinkle.value }));
  return (
    <Animated.View
      style={[
        styles.star,
        { left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

const STARS = Array.from({ length: 14 }, (_, i) => ({
  x: 8 + ((i * 53) % 84),
  y: 6 + ((i * 37) % 34),
  size: 1.6 + ((i * 7) % 3) * 0.9,
  delay: (i * 173) % 2200,
}));

export default function ScenesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const x = useSharedValue(0); // 0 .. -LAST*SCREEN_W
  const startX = useSharedValue(0);
  const p = useDerivedValue(() => interpolate(x.value, [0, -LAST * SCREEN_W], [0, LAST], Extrapolation.CLAMP));

  const finish = useCallback(() => {
    router.push('/(auth)/welcome');
  }, [router]);

  const goToPage = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(LAST, next));
    setPage(clamped);
    x.value = withSpring(-clamped * SCREEN_W, { damping: 18, stiffness: 110, mass: 0.9 });
  }, [x]);

  const handleNext = () => {
    if (page >= LAST) finish();
    else goToPage(page + 1);
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
    })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      x.value = Math.min(0, Math.max(-LAST * SCREEN_W, next));
    })
    .onEnd((e) => {
      const projected = -(x.value + e.velocityX * 0.15) / SCREEN_W;
      const target = Math.round(Math.max(0, Math.min(LAST, projected)));
      runOnJS(goToPage)(target);
    });

  // ---- sky: three gradients crossfaded by scrub progress ----
  const skyMorningStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [1, 0], Extrapolation.CLAMP) }));
  const skyMiddayStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1, 2], [0, 1, 0], Extrapolation.CLAMP) }));
  const skyNightStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [1.1, 2], [0, 1], Extrapolation.CLAMP) }));
  const starsStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [1.35, 1.95], [0, 1], Extrapolation.CLAMP) }));
  const cloudsBirdsStyle = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.9, 1.4], [0.9, 0.7, 0], Extrapolation.CLAMP) }));

  // ---- the celestial dial: sun and moon ride one wheel, 180deg apart ----
  const sunStyle = useAnimatedStyle(() => {
    const dial = interpolate(p.value, [0, 1, 2], [-52, 0, 180]);
    const rad = (dial * Math.PI) / 180;
    return {
      transform: [
        { translateX: SCREEN_W / 2 + DIAL_R * Math.sin(rad) - 30 },
        { translateY: DIAL_CY - DIAL_R * Math.cos(rad) - 30 },
      ],
      opacity: interpolate(p.value, [0, 1, 1.7, 2], [0.9, 1, 1, 0], Extrapolation.CLAMP),
    };
  });
  const sunHaloStyle = useAnimatedStyle(() => {
    const dial = interpolate(p.value, [0, 1, 2], [-52, 0, 180]);
    const rad = (dial * Math.PI) / 180;
    return {
      transform: [
        { translateX: SCREEN_W / 2 + DIAL_R * Math.sin(rad) - 70 },
        { translateY: DIAL_CY - DIAL_R * Math.cos(rad) - 70 },
      ],
      opacity: interpolate(p.value, [0, 0.45, 1, 1.5, 1.85], [0.55, 0.36, 0.32, 0.55, 0], Extrapolation.CLAMP),
    };
  });
  const moonStyle = useAnimatedStyle(() => {
    const dial = interpolate(p.value, [0, 1, 2], [-52 - 180, -180, 0]);
    const rad = (dial * Math.PI) / 180;
    return {
      transform: [
        { translateX: SCREEN_W / 2 + DIAL_R * Math.sin(rad) - 24 },
        { translateY: DIAL_CY - DIAL_R * Math.cos(rad) - 24 },
      ],
      opacity: interpolate(p.value, [1.35, 1.8], [0, 1], Extrapolation.CLAMP),
    };
  });
  const moonHaloStyle = useAnimatedStyle(() => {
    const dial = interpolate(p.value, [0, 1, 2], [-52 - 180, -180, 0]);
    const rad = (dial * Math.PI) / 180;
    return {
      transform: [
        { translateX: SCREEN_W / 2 + DIAL_R * Math.sin(rad) - 55 },
        { translateY: DIAL_CY - DIAL_R * Math.cos(rad) - 55 },
      ],
      opacity: interpolate(p.value, [1.5, 2], [0, 0.35], Extrapolation.CLAMP),
    };
  });

  // ---- ridge tint: three soft, overlapping dune layers (back = lightest/
  // furthest, front = darkest/closest), each crossfading warm-day to
  // indigo-night ----
  const ridgeBackProps = useAnimatedProps(() => ({
    fill: interpolateColor(p.value, [0, 1, 2], ['#e8c3a1', '#eccfae', '#2f3a63']),
  }));
  const ridgeMidProps = useAnimatedProps(() => ({
    fill: interpolateColor(p.value, [0, 1, 2], ['#dd935f', '#e2a06e', '#242c52']),
  }));
  const ridgeFrontProps = useAnimatedProps(() => ({
    fill: interpolateColor(p.value, [0, 1, 2], ['#a8504a', '#b25c4f', '#181f42']),
  }));
  // Organic painted highlight patches hugging the back layer's peaks — soft
  // filled blobs, not a stroked outline — crossfading cream-by-day to a
  // faint moonlit tint by night.
  const ridgeHighlight1Props = useAnimatedProps(() => ({
    fill: interpolateColor(p.value, [0, 1, 2], ['#f5ddc8', '#f8e6d3', '#3f4a78']),
  }));
  const ridgeHighlight2Props = useAnimatedProps(() => ({
    fill: interpolateColor(p.value, [0, 1, 2], ['#f5ddc8', '#f8e6d3', '#3f4a78']),
  }));

  // ---- clouds drift gently, independent of scrub ----
  const cloud1 = useSharedValue(0);
  const cloud2 = useSharedValue(0);
  useEffect(() => {
    cloud1.value = withRepeat(withSequence(withTiming(14, { duration: 13000 }), withTiming(0, { duration: 13000 })), -1, true);
    cloud2.value = withRepeat(withSequence(withTiming(-18, { duration: 17000 }), withTiming(0, { duration: 17000 })), -1, true);
  }, [cloud1, cloud2]);
  const cloud1Style = useAnimatedStyle(() => ({ transform: [{ translateX: cloud1.value }] }));
  const cloud2Style = useAnimatedStyle(() => ({ transform: [{ translateX: cloud2.value }] }));

  // ---- the sun-path pager: also a live scrubber ----
  const arcLen = useAnimatedProps(() => ({ strokeDashoffset: 130 * (1 - interpolate(p.value, [0, 2], [0, 1], Extrapolation.CLAMP)) }));
  const dotProps = useAnimatedProps(() => {
    const t = Math.min(Math.max(p.value, 0), 2) / 2;
    return {
      cx: 8 + t * 104,
      cy: 36 - Math.sin(t * Math.PI) * 24,
    };
  });
  const arcPan = Gesture.Pan()
    .onUpdate((e) => {
      const t = Math.min(1, Math.max(0, e.x / 120));
      x.value = -t * LAST * SCREEN_W;
    })
    .onEnd(() => {
      const target = Math.round(Math.max(0, Math.min(LAST, -x.value / SCREEN_W)));
      runOnJS(goToPage)(target);
    });

  const pageKey = PAGES[page];

  // ---- copy color: dark warm brown reads clearly on the light morning/
  // midday sky; only flips to white once the sky has actually gone dark,
  // so it never sits low-contrast against a light background ----
  const titleColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1.5, 1.85, 2], ['#4a3324', '#4a3324', '#f3ede6', '#ffffff']),
  }));
  const bodyColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1.5, 1.85, 2], ['#6b4a35', '#6b4a35', '#eee2d6', 'rgba(255,255,255,0.9)']),
  }));

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, skyMorningStyle]}>
            <LinearGradient colors={['#fdf6ec', '#f6dfc4', '#e3a374']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, skyMiddayStyle]}>
            <LinearGradient colors={['#eaf3f7', '#f3ddc8', '#dfa17c']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, skyNightStyle]}>
            <LinearGradient colors={['#070c20', '#10173a', '#3a4170']} style={StyleSheet.absoluteFill} />
          </Animated.View>

          <Animated.View style={[styles.starsLayer, starsStyle]} pointerEvents="none">
            {STARS.map((s, i) => (
              <Star key={i} x={s.x} y={s.y} size={s.size} delay={s.delay} />
            ))}
          </Animated.View>

          <Animated.View style={[styles.glow, styles.sunHalo, sunHaloStyle]} pointerEvents="none">
            <View style={styles.sunHaloCore} />
          </Animated.View>
          <Animated.View style={[styles.sun, sunStyle]} pointerEvents="none" />
          <Animated.View style={[styles.glow, styles.moonHalo, moonHaloStyle]} pointerEvents="none" />
          <Animated.View style={[styles.moon, moonStyle]} pointerEvents="none">
            <View style={styles.moonBite} />
          </Animated.View>

          <Animated.View style={[styles.cloudsLayer, cloudsBirdsStyle]} pointerEvents="none">
            <Animated.View style={[styles.cloud1, cloud1Style]}>
              <Svg width={62} height={42} viewBox="0 0 36 24">
                <Path d="M28.5 21H8a6 6 0 0 1-1.1-11.9 9 9 0 0 1 17.3-2.4A6.5 6.5 0 0 1 28.5 21Z" fill="rgba(255,255,255,0.75)" />
              </Svg>
            </Animated.View>
            <Animated.View style={[styles.cloud2, cloud2Style]}>
              <Svg width={44} height={30} viewBox="0 0 36 24">
                <Path d="M28.5 21H8a6 6 0 0 1-1.1-11.9 9 9 0 0 1 17.3-2.4A6.5 6.5 0 0 1 28.5 21Z" fill="rgba(255,255,255,0.7)" />
              </Svg>
            </Animated.View>
            <Svg width={56} height={22} style={styles.birds}>
              <Path d="M 6 12 q 5 -5 10 0 q 5 -5 10 0" stroke="rgba(110,61,40,0.55)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              <Path d="M 34 7 q 4 -4 8 0 q 4 -4 8 0" stroke="rgba(110,61,40,0.55)" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            </Svg>
          </Animated.View>

          {/* Mountain ridge — three soft dune layers with irregular, varied
              peaks (smooth bezier curves, not sharp/uniform triangles), each
              nearer layer a bit lower and darker for depth. Two organic
              painted highlight patches (filled shapes, not a stroked line)
              sit along the back layer's peaks like sunlit rock faces. */}
          <View style={styles.ridgeWrap} pointerEvents="none">
            <Svg width={SCREEN_W} height={SCREEN_H - RIDGE_TOP} viewBox="0 0 400 200" preserveAspectRatio="none">
              <AnimatedPath
                animatedProps={ridgeBackProps}
                d="M0,110 C40,70 70,30 110,50 C150,70 165,20 205,35 C245,50 260,90 300,75 C335,62 365,95 400,85 L400,200 L0,200 Z"
              />
              <AnimatedPath
                animatedProps={ridgeHighlight1Props}
                d="M52,48 C68,30 85,30 102,44 L108,54 C90,42 74,42 60,58 Z"
              />
              <AnimatedPath
                animatedProps={ridgeHighlight2Props}
                d="M110,50 C150,70 165,20 205,35 L205,45 C165,30 150,80 110,60 Z"
              />
              <AnimatedPath
                animatedProps={ridgeMidProps}
                d="M0,150 C60,95 120,110 175,80 C220,58 250,100 305,95 C345,92 375,115 400,110 L400,200 L0,200 Z"
              />
              <AnimatedPath
                animatedProps={ridgeFrontProps}
                d="M0,178 C80,140 150,175 215,150 C270,130 310,168 400,145 L400,200 L0,200 Z"
              />
            </Svg>
          </View>
        </Animated.View>
      </GestureDetector>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.skipWrap} pointerEvents="box-none">
          <Animated.View entering={FadeIn.delay(400).duration(400)}>
            <Pressable onPress={finish} accessibilityLabel={t('scenes.skip')}>
              <BlurView intensity={40} tint="light" style={styles.skipButton}>
                <ChevronRight size={18} color="#4a3324" strokeWidth={2.4} />
              </BlurView>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.copyWrap} pointerEvents="none">
          <Animated.View key={pageKey} entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(200)}>
            <Animated.Text style={[styles.title, titleColorStyle]}>{t(`scenes.${pageKey}Title`)}</Animated.Text>
            <Animated.Text style={[styles.body, bodyColorStyle]}>{t(`scenes.${pageKey}Body`)}</Animated.Text>
          </Animated.View>
        </View>

        <View style={styles.footer} pointerEvents="box-none">
          <GestureDetector gesture={arcPan}>
            <View style={styles.arcHitbox}>
              <Svg width={120} height={44} viewBox="0 0 120 44">
                <Path
                  d="M 8 36 Q 60 -10 112 36"
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="0.1 6"
                />
                <AnimatedPath
                  d="M 8 36 Q 60 -10 112 36"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={130}
                  animatedProps={arcLen}
                />
                <AnimatedCircle animatedProps={dotProps} r={9} fill="rgba(255,255,255,0.35)" />
                <AnimatedCircle animatedProps={dotProps} r={5} fill="#ffffff" />
              </Svg>
            </View>
          </GestureDetector>

          <Pressable style={styles.ctaButton} onPress={handleNext}>
            <LinearGradient colors={['#ffffff', '#f3ddc8']} style={StyleSheet.absoluteFill} />
            <Text style={styles.ctaText}>
              {page >= LAST ? t('scenes.getStarted') : t('scenes.next')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f1ea',
    overflow: 'hidden',
  },
  starsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#dfe6ff',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
  },
  sunHalo: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(246,190,108,0.16)',
  },
  sunHaloCore: {
    position: 'absolute',
    top: 25,
    left: 25,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(246,190,108,0.4)',
  },
  moonHalo: {
    width: 110,
    height: 110,
    backgroundColor: 'rgba(216,226,255,0.3)',
  },
  sun: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: SUN_COLOR,
  },
  moon: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOON_COLOR,
    overflow: 'hidden',
  },
  moonBite: {
    position: 'absolute',
    top: -6,
    right: -10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NIGHT_BITE_COLOR,
  },
  cloudsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  cloud1: {
    position: 'absolute',
    top: '30%',
    left: '10%',
  },
  cloud2: {
    position: 'absolute',
    top: '38%',
    right: '14%',
  },
  birds: {
    position: 'absolute',
    top: '36%',
    left: '26%',
  },
  ridgeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: RIDGE_TOP,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  skipWrap: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  skipButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copyWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    lineHeight: 38,
  },
  body: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
    lineHeight: 22,
    maxWidth: '86%',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  arcHitbox: {
    width: 120,
    height: 44,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  ctaButton: {
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#a85a44',
  },
});
