import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';

interface MorphTextProps {
  /** The text to display — usually a formatted number (e.g. "₹1,540", "42"). */
  value: string;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Animates text changes character-by-character instead of hard-cutting to
 * the new value — matching characters hold their position, only the ones
 * that actually changed morph out/in. Built natively with Reanimated
 * (torph itself is a web/DOM-only library and can't run in React Native)
 * for use on numbers that update live: stats, prices, counts.
 */
export const MorphText: React.FC<MorphTextProps> = ({ value, style, containerStyle }) => {
  const characters = value.split('');

  return (
    <View style={[styles.row, containerStyle]}>
      {characters.map((char, index) => (
        <Animated.View
          key={`${index}-${char}`}
          entering={FadeInUp.duration(240)}
          exiting={FadeOutUp.duration(240)}
          layout={LinearTransition.duration(240)}
        >
          <Text style={style}>{char === ' ' ? ' ' : char}</Text>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
});
