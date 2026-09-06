import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../features/theme/context';
import { IconCard } from './IconCard';
import { CraftType } from '../../types';
import { apiClient } from '../../lib/api-client';
import { getCraftIcon } from '../../lib/craftIcons';

// Shown immediately while the real list loads, and kept as a fallback if the
// backend is unreachable — never leaves the picker empty.
export const FALLBACK_CRAFTS: CraftType[] = [
  { id: 'pottery', name_en: 'Pottery & Ceramics', name_hi: 'मिट्टी के बर्तन' },
  { id: 'weaving', name_en: 'Weaving & Textiles', name_hi: 'बुनाई और कपड़े' },
  { id: 'embroidery', name_en: 'Embroidery', name_hi: 'कढ़ाई' },
  { id: 'woodwork', name_en: 'Woodwork & Carving', name_hi: 'लकड़ी का काम' },
  { id: 'metalwork', name_en: 'Metalwork & Brass', name_hi: 'धातु का काम' },
  { id: 'painting', name_en: 'Painting & Art', name_hi: 'चित्रकारी' },
  { id: 'bamboo', name_en: 'Bamboo & Cane', name_hi: 'बांस और बेंत' },
  { id: 'leather', name_en: 'Leather Craft', name_hi: 'चमड़े का काम' },
  { id: 'stone', name_en: 'Stone Carving', name_hi: 'पत्थर की नक्काशी' },
  { id: 'block_print', name_en: 'Block Printing', name_hi: 'ब्लॉक प्रिंटिंग' },
  { id: 'jewelry', name_en: 'Jewelry & Ornaments', name_hi: 'आभूषण' },
  { id: 'other', name_en: 'Other Craft', name_hi: 'अन्य शिल्प' },
];

interface CraftPickerProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export const CraftPicker: React.FC<CraftPickerProps> = ({ selectedIds, onToggle }) => {
  const { colors } = useTheme();
  const [crafts, setCrafts] = useState<CraftType[]>(FALLBACK_CRAFTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/reference/crafts')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) {
          setCrafts(res.data);
        }
      })
      .catch(() => {
        // Offline or unreachable — keep the fallback list rather than an empty picker.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      {crafts.map((craft, index) => {
        const isSelected = selectedIds.includes(craft.id);
        const IconComponent = getCraftIcon(craft.id);
        return (
          <IconCard
            key={craft.id}
            index={index}
            icon={
              <IconComponent
                size={24}
                color={isSelected ? colors.primaryDark : colors.primary}
                strokeWidth={2}
              />
            }
            title={craft.name_en}
            subtitle={craft.name_hi}
            selected={isSelected}
            onPress={() => onToggle(craft.id)}
          />
        );
      })}
      {loading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingIndicator: {
    marginTop: 4,
  },
});
