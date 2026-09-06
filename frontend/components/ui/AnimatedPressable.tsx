import React from 'react';
import { Pressable, PressableProps, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | StyleProp<ViewStyle>[];
  scaleTo?: number;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  children,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <ReanimatedPressable
      accessibilityRole="button"
      style={[style as any, animatedStyle]}
      onPressIn={(e) => {
        // Critically damped (dampingRatio 1): settles cleanly on press with
        // no overshoot/wobble — bounce is reserved for momentum gestures
        // (flicks, drags), not static tap feedback.
        scale.value = withSpring(scaleTo, { duration: 220, dampingRatio: 1 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { duration: 220, dampingRatio: 1 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </ReanimatedPressable>
  );
};
