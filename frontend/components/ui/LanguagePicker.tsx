import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconCard } from './IconCard';

export interface LanguageOption {
  code: string;
  name_en: string;
  name_native: string;
  badge: string;
  color: string;
}

const DEFAULT_LANGUAGES: LanguageOption[] = [
  { code: 'hi', name_en: 'Hindi', name_native: 'हिन्दी', badge: 'हि', color: '#8C3128' },
  { code: 'en', name_en: 'English', name_native: 'English', badge: 'A', color: '#2C211A' },
  { code: 'mr', name_en: 'Marathi', name_native: 'मराठी', badge: 'म', color: '#4C7A52' },
  { code: 'bn', name_en: 'Bengali', name_native: 'বাংলা', badge: 'ব', color: '#C79A3E' },
  { code: 'ta', name_en: 'Tamil', name_native: 'தமிழ்', badge: 'த', color: '#A67C3D' },
  { code: 'gu', name_en: 'Gujarati', name_native: 'ગુજરાતી', badge: 'ગુ', color: '#5C6E7A' },
];

interface LanguagePickerProps {
  selectedCode: string;
  onSelect: (code: string) => void;
  languages?: LanguageOption[];
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  selectedCode,
  onSelect,
  languages = DEFAULT_LANGUAGES,
}) => {
  return (
    <View style={styles.container}>
      {languages.map((lang, index) => {
        const selected = selectedCode === lang.code;
        return (
          <IconCard
            key={lang.code}
            index={index}
            icon={
              <View style={[styles.badge, { backgroundColor: lang.color }]}>
                <Text style={styles.badgeText}>{lang.badge}</Text>
              </View>
            }
            title={lang.name_native}
            subtitle={lang.name_en}
            selected={selected}
            onPress={() => onSelect(lang.code)}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
