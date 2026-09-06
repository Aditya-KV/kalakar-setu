import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../features/theme/context';
import { ThemeColors } from '../../constants/Colors';
import { BorderRadius, FontSize, FontWeight, TouchTarget } from '../../constants/theme';
import { apiClient } from '../../lib/api-client';

export interface LocationState {
  code: string;
  name_en: string;
  name_hi: string;
}

export interface LocationDistrict {
  code: string;
  state_code: string;
  name_en: string;
  name_hi: string;
}

// Shown immediately while the real list loads, and kept as a fallback if the
// backend is unreachable — never leaves the picker empty.
const FALLBACK_STATES: LocationState[] = [
  { code: 'RJ', name_en: 'Rajasthan', name_hi: 'राजस्थान' },
  { code: 'UP', name_en: 'Uttar Pradesh', name_hi: 'उत्तर प्रदेश' },
  { code: 'MH', name_en: 'Maharashtra', name_hi: 'महाराष्ट्र' },
  { code: 'GJ', name_en: 'Gujarat', name_hi: 'गुजरात' },
  { code: 'WB', name_en: 'West Bengal', name_hi: 'पश्चिम बंगाल' },
  { code: 'DL', name_en: 'Delhi', name_hi: 'दिल्ली' },
];

interface LocationPickerProps {
  selectedState: string | null;
  selectedDistrict: string | null;
  onSelectState: (code: string) => void;
  onSelectDistrict: (code: string) => void;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  selectedState,
  selectedDistrict,
  onSelectState,
  onSelectDistrict,
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const showNative = i18n.language !== 'en';
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [districtModalOpen, setDistrictModalOpen] = useState(false);

  const [states, setStates] = useState<LocationState[]>(FALLBACK_STATES);
  const [statesLoading, setStatesLoading] = useState(true);
  const [districts, setDistricts] = useState<LocationDistrict[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/reference/states')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) {
          setStates(res.data);
        }
      })
      .catch(() => {
        // Offline or unreachable — keep the fallback list.
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    setDistrictsLoading(true);
    apiClient
      .get('/reference/districts', { params: { state_code: selectedState } })
      .then((res) => {
        if (!cancelled && Array.isArray(res.data)) {
          setDistricts(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  const activeStateObj = states.find((s) => s.code === selectedState);
  const activeDistrictObj = districts.find((d) => d.code === selectedDistrict);

  const displayName = (nameEn: string, nameHi: string) =>
    showNative ? `${nameEn} (${nameHi})` : nameEn;
  const listLabel = (nameEn: string, nameHi: string) =>
    showNative ? `${nameEn} — ${nameHi}` : nameEn;

  return (
    <View style={styles.container}>
      {/* State Selector */}
      <Text style={styles.label}>{t('onboarding.stateLabel')}</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setStateModalOpen(true)}
      >
        <Text style={activeStateObj ? styles.selectedText : styles.placeholderText}>
          {activeStateObj
            ? displayName(activeStateObj.name_en, activeStateObj.name_hi)
            : t('onboarding.selectStatePlaceholder')}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* District Selector */}
      <Text style={[styles.label, { marginTop: 16 }]}>{t('onboarding.districtLabel')}</Text>
      <TouchableOpacity
        style={[styles.pickerButton, !selectedState && styles.disabledButton]}
        disabled={!selectedState}
        onPress={() => setDistrictModalOpen(true)}
      >
        <Text style={activeDistrictObj ? styles.selectedText : styles.placeholderText}>
          {activeDistrictObj
            ? displayName(activeDistrictObj.name_en, activeDistrictObj.name_hi)
            : selectedState
            ? t('onboarding.selectDistrictPlaceholder')
            : t('onboarding.selectStateFirst')}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* State Modal */}
      <Modal visible={stateModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('onboarding.selectState')}</Text>
            {statesLoading && states === FALLBACK_STATES && (
              <ActivityIndicator color={colors.primary} style={styles.modalLoading} />
            )}
            <FlatList
              data={states}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedState === item.code && styles.selectedModalItem,
                  ]}
                  onPress={() => {
                    onSelectState(item.code);
                    setStateModalOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {listLabel(item.name_en, item.name_hi)}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setStateModalOpen(false)}
            >
              <Text style={styles.closeText}>{t('onboarding.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* District Modal */}
      <Modal visible={districtModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('onboarding.selectDistrict')}</Text>
            {districtsLoading && (
              <ActivityIndicator color={colors.primary} style={styles.modalLoading} />
            )}
            <FlatList
              data={districts}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedDistrict === item.code && styles.selectedModalItem,
                  ]}
                  onPress={() => {
                    onSelectDistrict(item.code);
                    setDistrictModalOpen(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {listLabel(item.name_en, item.name_hi)}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setDistrictModalOpen(false)}
            >
              <Text style={styles.closeText}>{t('onboarding.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  pickerButton: {
    minHeight: TouchTarget.minHeight,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  disabledButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  selectedText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  placeholderText: {
    fontSize: FontSize.md,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalLoading: {
    marginBottom: 12,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedModalItem: {
    backgroundColor: colors.primaryTint,
  },
  modalItemText: {
    fontSize: FontSize.md,
    color: colors.textPrimary,
  },
  closeButton: {
    marginTop: 16,
    paddingVertical: 14,
    backgroundColor: colors.secondary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
});
