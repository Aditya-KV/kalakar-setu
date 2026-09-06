import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  PanResponder,
  Text,
  ImageSourcePropType,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { BorderRadius, FontSize, FontWeight, Shadows } from '../../constants/theme';

interface BeforeAfterSliderProps {
  originalImage: string | ImageSourcePropType;
  enhancedImage: string | ImageSourcePropType;
  height?: number;
  originalLabel?: string;
  enhancedLabel?: string;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalImage,
  enhancedImage,
  height = 340,
  originalLabel,
  enhancedLabel,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const resolvedOriginalLabel = originalLabel ?? t('studio.originalLabel');
  const resolvedEnhancedLabel = enhancedLabel ?? t('studio.enhancedLabel');
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [sliderPosition, setSliderPosition] = useState<number>(0.5); // 0.0 to 1.0

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      if (containerWidth <= 0) return;
      const touchX = gestureState.moveX; // or evt.nativeEvent.locationX
      const newPos = Math.max(0.05, Math.min(0.95, gestureState.x0 + gestureState.dx));
      const ratio = Math.max(0.05, Math.min(0.95, newPos / containerWidth));
      setSliderPosition(ratio);
    },
  });

  const origSource = typeof originalImage === 'string' ? { uri: originalImage } : originalImage;
  const enhSource = typeof enhancedImage === 'string' ? { uri: enhancedImage } : enhancedImage;

  const splitWidth = containerWidth * sliderPosition;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.container, { height }]}>
      <View
        style={styles.innerContainer}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {/* Layer 1: Enhanced Image (Full Width Background) */}
        <Image source={enhSource} style={styles.image} resizeMode="cover" />

        {/* Enhanced Label (Right) */}
        <View style={styles.enhancedLabelBadge}>
          <Text style={styles.labelText}>{resolvedEnhancedLabel}</Text>
        </View>

        {/* Layer 2: Original Image (Clipped by slider position) */}
        <View style={[styles.clippedContainer, { width: splitWidth }]}>
          <Image
            source={origSource}
            style={[styles.image, { width: containerWidth }]}
            resizeMode="cover"
          />
          {/* Original Label (Left) */}
          <View style={styles.originalLabelBadge}>
            <Text style={styles.labelText}>{resolvedOriginalLabel}</Text>
          </View>
        </View>

        {/* Vertical Divider Handle */}
        <View
          style={[styles.divider, { left: splitWidth - 1.5 }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleCircle}>
            <ChevronLeft size={12} color={colors.primary} strokeWidth={3} />
            <ChevronRight size={12} color={colors.primary} strokeWidth={3} />
          </View>
        </View>
      </View>

      <View style={styles.hintRow}>
        <MoveHorizontal size={14} color={colors.textSecondary} strokeWidth={2} />
        <Text style={styles.hintText}>
          {t('studio.dragHint')}
        </Text>
      </View>
    </Animated.View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 12,
  },
  innerContainer: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.card,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  clippedContainer: {
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  originalLabelBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  enhancedLabelBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  handleCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    ...Shadows.button,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  hintText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
