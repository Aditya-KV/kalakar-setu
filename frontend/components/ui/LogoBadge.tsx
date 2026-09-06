import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PenTool } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { FontWeight } from '../../constants/theme';

interface LogoBadgeProps {
  size?: number;
  showWordmark?: boolean;
}

// A simplified, UI-scale recreation of the Kalakar Setu badge mark — a
// cream-ringed maroon oval with a quill/pen motif. The full illustrated
// version (with flourish + lettering) only reads clearly at poster size;
// at in-app sizes (avatar, header, hero) this captures the same badge
// silhouette and brand colors cleanly.
export const LogoBadge: React.FC<LogoBadgeProps> = ({ size = 72, showWordmark = false }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const ringWidth = Math.max(2, size * 0.05);
  const iconSize = size * 0.44;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringWidth,
          },
        ]}
      >
        <PenTool size={iconSize} color={colors.background} strokeWidth={2} />
      </View>
      {showWordmark && (
        <Text style={[styles.wordmark, { fontSize: size * 0.2 }]}>KALAKAR SETU</Text>
      )}
    </View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  badge: {
    backgroundColor: colors.primary,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 8,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
    color: colors.primary,
    textAlign: 'center',
  },
});
