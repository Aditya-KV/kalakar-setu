import React, { useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions } from 'react-native';
import { useTheme } from '../../features/theme/context';
import { BorderRadius, FontSize, FontWeight } from '../../constants/theme';

export interface CarouselImage {
  key: string;
  url: string;
}

interface ImageCarouselProps {
  images: CarouselImage[];
  height?: number;
  placeholder?: React.ReactNode;
}

// Full-width swipeable photo gallery with page-dot indicators and a
// "1 / N" counter — used wherever a listing's multiple photos need to be
// genuinely browsable, not just implied by a count badge.
export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, height = 340, placeholder }) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View style={[styles.image, { width, height }, styles.placeholder, { backgroundColor: colors.primaryTint }]}>
        {placeholder}
      </View>
    );
  }

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {images.map((img) => (
          <Image key={img.key} source={{ uri: img.url }} style={[styles.image, { width, height }]} resizeMode="cover" />
        ))}
      </ScrollView>

      {images.length > 1 && (
        <>
          <View style={styles.dotsRow} pointerEvents="none">
            {images.map((img, i) => (
              <View
                key={img.key}
                style={[
                  styles.dot,
                  { backgroundColor: i === index ? '#FFFFFF' : 'rgba(255,255,255,0.45)' },
                  i === index && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.counterPill} pointerEvents="none">
            <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#00000010',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 16,
  },
  counterPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
});
