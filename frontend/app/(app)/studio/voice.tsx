import React, { useEffect, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Pressable,
  ScrollView,
  Spinner,
  Badge,
  BadgeText,
  Textarea,
  TextareaInput,
} from '@gluestack-ui/themed';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  X,
  Mic,
  Square,
  Pencil,
  Check,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  PenLine,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../features/auth/hooks';
import { useCatalogDraft } from '../../../features/catalog/context';
import { useTheme } from '../../../features/theme/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { preserveDraftMedia } from '../../../lib/draft-media';
import { mediaForm } from '../../../lib/media-form';
import { productText } from '../../../lib/product-text';
import { apiClient } from '../../../lib/api-client';
import { useExitToHomeOnBack } from '../../../lib/exit-to-home';


type SourceLanguage = 'hi' | 'en' | 'mr';

const LANGUAGE_OPTIONS: { code: SourceLanguage; label: string; native: string }[] = [
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en', label: 'English', native: 'English' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
];

type Status = 'idle' | 'recording' | 'manual' | 'transcribing' | 'review' | 'editing' | 'structuring' | 'result';

interface TranscriptData {
  transcript: string;
  confidence: number;
  translations: Record<string, string>;
}

interface StructuredListing {
  title: { en: string; hi: string; mr?: string | null };
  description: { en: string; hi: string; mr?: string | null };
  attributes: { material: string[]; color: string[]; technique: string[] };
  keywords: string[];
  craft_type?: string | null;
  generated_by?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function VoiceDescriptionScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { draft, updateDraft, setVoiceStep } = useCatalogDraft();

  const defaultLanguage: SourceLanguage =
    user?.preferred_language === 'en' || user?.preferred_language === 'mr'
      ? user.preferred_language
      : 'hi';

  const [status, setStatus] = useState<Status>(draft.title && draft.description ? 'result' : draft.transcript ? 'manual' : 'idle');
  const [sourceLanguage, setSourceLanguageState] = useState<SourceLanguage>(draft.transcript || draft.recordingUri ? draft.sourceLanguage : defaultLanguage);
  const setSourceLanguage = (sourceLanguage: SourceLanguage) => { setSourceLanguageState(sourceLanguage); updateDraft({ sourceLanguage }); };
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [durationMs, setDurationMs] = useState(0);
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null);
  const [editedTranscript, setEditedTranscriptState] = useState(draft.transcript);
  const setEditedTranscript = (transcript: string) => { setEditedTranscriptState(transcript); updateDraft({ transcript, sourceLanguage, title: null, description: null }); };
  const [manualText, setManualTextState] = useState(draft.transcript);
  const setManualText = (transcript: string) => { setManualTextState(transcript); updateDraft({ transcript, sourceLanguage, title: null, description: null }); };
  const [listing, setListing] = useState<StructuredListing | null>(draft.title && draft.description ? { title: draft.title, description: draft.description, attributes: draft.attributes || { material: [], color: [], technique: [] }, keywords: draft.keywords } : null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const request = useRef<AbortController | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === 'recording') {
      pulse.value = withRepeat(withTiming(1.18, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      request.current?.abort();
    };
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const craftType = user?.craft_types?.[0];

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('studio.permissionTitle'), t('studio.microphonePermission'));
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      setDurationMs(0);
      setStatus('recording');

      timerRef.current = setInterval(() => {
        setDurationMs((prev) => prev + 1000);
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording:', e);
      Alert.alert(t('common.error'), t('studio.recordingError'));
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setStatus('transcribing');
      if (uri) {
        const savedUri = await preserveDraftMedia(uri, user!.id, 'recording');
        updateDraft({ recordingUri: savedUri, sourceLanguage });
        await uploadRecording(savedUri);
      } else {
        throw new Error('Recording produced no output file');
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
      setErrorMessage(t('studio.recordingError'));
      setStatus('idle');
    }
  };

  const uploadRecording = async (uri: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('transcribing');
    setErrorMessage(null);
    try {
      const isWeb = Platform.OS === 'web';
      const formData = await mediaForm(uri, isWeb ? 'recording.webm' : 'recording.m4a', isWeb ? 'audio/webm' : 'audio/m4a');
      formData.append('language', sourceLanguage);

      const res = await apiClient.post('/catalog/voice-describe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000, signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      const data = res.data;
      if (!data.transcript) {
        setErrorMessage(
          t('studio.audioUnclear')
        );
        setStatus('idle');
        return;
      }

      setTranscriptData({
        transcript: data.transcript,
        confidence: data.confidence,
        translations: data.translations,
      });
      setEditedTranscript(data.transcript);
      setStatus('review');
    } catch (e) {
      if (controller.signal.aborted) return;
      setErrorMessage(t('studio.transcriptionFailed'));
      setStatus('idle');
    }
  };

  const generateListing = async (transcript: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    updateDraft({ transcript, sourceLanguage });
    setStatus('structuring');
    setErrorMessage(null);
    try {
      const res = await apiClient.post('/catalog/structure', {
        transcript,
        source_language: sourceLanguage,
        craft_type: craftType,
      }, { timeout: 120000, signal: controller.signal });
      if (controller.signal.aborted) return;
      setListing(res.data);
      setVoiceStep({
        title: res.data.title,
        description: res.data.description,
        attributes: res.data.attributes,
        keywords: res.data.keywords,
        craftType: res.data.craft_type || null,
      });
      setStatus('result');
    } catch (e) {
      if (controller.signal.aborted) return;
      setErrorMessage(t('studio.structureFailed'));
      setManualTextState(transcript);
      setStatus(transcriptData ? 'review' : 'manual');
    }
  };

  const handleRetry = () => {
    updateDraft({ title: null, description: null, attributes: null, keywords: [], craftType: null, recordingUri: null });
    setTranscriptData(null);
    setEditedTranscript('');
    setManualText('');
    setListing(null);
    setErrorMessage(null);
    setDurationMs(0);
    setStatus('idle');
  };

  const isBusy = status === 'transcribing' || status === 'structuring';
  const isRecording = status === 'recording';
  useExitToHomeOnBack(!isBusy && !isRecording);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <Box flex={1} bg="$backgroundLight0" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <HStack
        alignItems="center"
        justifyContent="space-between"
        px="$5"
        py="$4"
        bg="$white"
        borderBottomWidth={1}
        borderBottomColor="$borderLight200"
        style={{ borderBottomColor: colors.border }}
      >
        <Pressable accessibilityLabel={t('common.back')} disabled={isBusy || isRecording} onPress={() => router.back()} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </Pressable>
        <Text fontSize="$md" fontWeight="$bold" style={{ color: colors.textPrimary }}>
          {t('studio.describeTitle')}
        </Text>
        <Box width={22} />
      </HStack>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 48 }}>
        {/* Stepper */}
        <HStack alignItems="center" justifyContent="center" mb="$6" space="xs">
          <StepDot label={t('studio.stepPhoto')} state="done" colors={colors} />
          <StepLine colors={colors} />
          <StepDot label={t('studio.stepVoice')} state="active" colors={colors} />
          <StepLine colors={colors} />
          <StepDot label={t('studio.stepPrice')} state="pending" colors={colors} />
          <StepLine colors={colors} />
          <StepDot label={t('studio.stepPublish')} state="pending" colors={colors} />
        </HStack>

        <Heading
          size="lg"
          textAlign="center"
          style={{ color: colors.textPrimary }}
        >
          {t('studio.describeHeading')}
        </Heading>
        <Text textAlign="center" mt="$3" px="$4" style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>
          {t('studio.describeSubtitle')}
        </Text>

        {/* Language selector */}
        {(status === 'idle' || status === 'recording' || status === 'manual') && (
          <HStack justifyContent="center" mt="$5" space="sm">
            {LANGUAGE_OPTIONS.map((lang) => {
              const selected = sourceLanguage === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  disabled={isRecording}
                  onPress={() => setSourceLanguage(lang.code)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    borderRadius: BorderRadius.round,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : colors.surface,
                    opacity: isRecording ? 0.5 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: FontSize.sm,
                      fontWeight: FontWeight.semibold,
                      color: selected ? '#FFFFFF' : colors.textPrimary,
                    }}
                  >
                    {lang.native}
                  </Text>
                </Pressable>
              );
            })}
          </HStack>
        )}

        {errorMessage && (
          <HStack
            mt="$5"
            p="$3"
            borderRadius="$lg"
            alignItems="center"
            space="sm"
            style={{ backgroundColor: colors.errorLight, borderRadius: BorderRadius.md }}
          >
            <AlertTriangle size={18} color={colors.error} />
            <Text flex={1} style={{ color: colors.error, fontSize: FontSize.xs }}>
              {errorMessage}
            </Text>
          </HStack>
        )}

        {status === 'idle' && draft.recordingUri && <Button title={t('studio.retryRecording')} onPress={() => uploadRecording(draft.recordingUri!)} style={{ marginTop: Spacing.md }} />}

        {/* Recording / idle mic control */}
        {(status === 'idle' || status === 'recording') && (
          <VStack alignItems="center" mt="$8" space="md">
            <Box alignItems="center" justifyContent="center" width={180} height={180}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: 160,
                    height: 160,
                    borderRadius: 80,
                    backgroundColor: colors.primaryLight,
                  },
                  pulseStyle,
                ]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(isRecording ? 'studio.recording' : 'studio.tapToRecord')}
                onPress={isRecording ? stopRecording : startRecording}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...Shadows.button,
                }}
              >
                {isRecording ? <Square size={36} color="#FFFFFF" /> : <Mic size={40} color="#FFFFFF" />}
              </Pressable>
            </Box>

            {isRecording ? (
              <VStack alignItems="center" space="xs">
                <Text style={{ fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: colors.textPrimary }}>
                  {formatDuration(durationMs)}
                </Text>
                <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                  {t('studio.recording')}
                </Text>
              </VStack>
            ) : (
              <Text style={{ fontSize: FontSize.xs, color: colors.textSecondary }}>
                {t('studio.tapToRecord')}
              </Text>
            )}
          </VStack>
        )}

        {/* Switch to typing instead of recording */}
        {status === 'idle' && (
          <Pressable
            onPress={() => { setManualTextState(draft.transcript); setStatus('manual'); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: Spacing.lg,
              paddingVertical: 8,
            }}
          >
            <PenLine size={15} color={colors.textSecondary} strokeWidth={2} />
            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: colors.textSecondary }}>
              {t('studio.typeInstead')}
            </Text>
          </Pressable>
        )}

        {/* Manual text entry */}
        {status === 'manual' && (
          <VStack mt="$5" space="md">
            <Textarea
              borderColor="$borderLight300"
              style={{ borderColor: colors.border, borderRadius: BorderRadius.md, backgroundColor: colors.surface }}
            >
              <TextareaInput
                value={manualText}
                onChangeText={setManualText}
                placeholder={t('studio.manualPlaceholder')}
                style={{ fontSize: FontSize.sm, color: colors.textPrimary, minHeight: 140 }}
              />
            </Textarea>

            <HStack space="sm">
              <Pressable
                onPress={() => setStatus('idle')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                }}
              >
                <Mic size={16} color={colors.textPrimary} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.textPrimary }}>
                  {t('studio.useVoiceInstead')}
                </Text>
              </Pressable>

              <Button
                title={t('studio.approve')}
                onPress={() => generateListing(manualText.trim())}
                disabled={!manualText.trim()}
                icon={<Check size={18} color="#FFFFFF" />}
                style={{ flex: 1 }}
              />
            </HStack>
          </VStack>
        )}

        {/* Busy states */}
        {isBusy && (
          <VStack alignItems="center" mt="$10" space="md">
            <Spinner size="large" color={colors.primary} />
            <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center' }}>
              {status === 'transcribing' ? t('studio.transcribing') : t('studio.creatingListing')}
            </Text>
          </VStack>
        )}

        {/* Transcript review / edit */}
        {(status === 'review' || status === 'editing') && transcriptData && (
          <Box
            mt="$6"
            p="$4"
            borderRadius="$lg"
            bg="$white"
            borderWidth={1}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: BorderRadius.lg,
              ...Shadows.card,
            }}
          >
            <Text style={{ fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: colors.textMuted, marginBottom: 8 }}>
              {t('studio.yourDescription')}
            </Text>

            {status === 'editing' ? (
              <Textarea
                borderColor="$borderLight300"
                style={{ borderColor: colors.border, borderRadius: BorderRadius.md }}
              >
                <TextareaInput
                  value={editedTranscript}
                  onChangeText={setEditedTranscript}
                  placeholder={t('studio.editPlaceholder')}
                  style={{ fontSize: FontSize.sm, color: colors.textPrimary, minHeight: 100 }}
                />
              </Textarea>
            ) : (
              <Text style={{ fontSize: FontSize.md, color: colors.textPrimary, lineHeight: 22 }}>
                {editedTranscript}
              </Text>
            )}

            {transcriptData.translations && sourceLanguage !== 'en' && transcriptData.translations.en && (
              <Text mt="$3" style={{ fontSize: FontSize.sm, color: colors.textSecondary, fontStyle: 'italic' }}>
                {transcriptData.translations.en}
              </Text>
            )}

            <HStack mt="$5" space="sm">
              {status === 'review' ? (
                <>
                  <Pressable
                    onPress={() => setStatus('editing')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      paddingVertical: 14,
                      borderRadius: BorderRadius.md,
                      borderWidth: 1.5,
                      borderColor: colors.border,
                    }}
                  >
                    <Pencil size={16} color={colors.textPrimary} />
                    <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.textPrimary }}>
                      {t('studio.editAction')}
                    </Text>
                  </Pressable>

                  <Button
                    title={t('studio.approve')}
                    onPress={() => generateListing(editedTranscript)}
                    icon={<Check size={18} color="#FFFFFF" />}
                    style={{ flex: 1 }}
                  />
                </>
              ) : (
                <Button
                  title={t('studio.saveEdit')}
                  onPress={() => setStatus('review')}
                  disabled={!editedTranscript.trim()}
                  style={{ flex: 1 }}
                />
              )}
            </HStack>
          </Box>
        )}

        {/* Structured listing result */}
        {status === 'result' && listing && (
          <VStack mt="$6" space="md">
            <Box
              p="$4"
              borderRadius="$lg"
              bg="$white"
              borderTopWidth={4}
              style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.success,
                borderRadius: BorderRadius.lg,
                ...Shadows.card,
              }}
            >
              {listing.generated_by && listing.generated_by !== 'keyword_fallback' && (
                <HStack alignItems="center" space="xs" mb="$2">
                  <Sparkles size={13} color={colors.accent} strokeWidth={2} />
                  <Text style={{ fontSize: 11, fontWeight: FontWeight.bold, color: colors.accent }}>
                    {t('studio.aiEnhanced')}
                  </Text>
                </HStack>
              )}
              <Heading size="sm" style={{ color: colors.textPrimary }}>
                {productText(listing.title, i18n.language)}
              </Heading>
              <Text mt="$1" style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>
                {i18n.language.split('-')[0] === 'en' ? '' : listing.title.en}
              </Text>

              <Text mt="$4" style={{ color: colors.textPrimary, lineHeight: 22 }}>
                {productText(listing.description, i18n.language)}
              </Text>
              <Text mt="$2" style={{ color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 }}>
                {i18n.language.split('-')[0] === 'mr' && !listing.description.mr ? t('common.translationFallback') : ''}
              </Text>

              {(listing.attributes.material.length > 0 ||
                listing.attributes.color.length > 0 ||
                listing.attributes.technique.length > 0) && (
                <HStack mt="$4" flexWrap="wrap" space="xs">
                  {[...listing.attributes.technique, ...listing.attributes.material, ...listing.attributes.color].map(
                    (attr) => (
                      <Badge
                        key={attr}
                        mr="$2"
                        mb="$2"
                        borderRadius="$full"
                        style={{ backgroundColor: colors.surfaceElevated, borderRadius: BorderRadius.round }}
                      >
                        <BadgeText style={{ color: colors.textPrimary, fontSize: FontSize.xs }}>{attr}</BadgeText>
                      </Badge>
                    )
                  )}
                </HStack>
              )}
            </Box>

            <HStack space="sm">
              <Pressable
                onPress={handleRetry}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 16,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1.5,
                  borderColor: colors.border,
                }}
              >
                <RotateCcw size={16} color={colors.textPrimary} />
                <Text style={{ fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: colors.textPrimary }}>
                  {t('studio.recordAgain')}
                </Text>
              </Pressable>

              <Button
                title={t('studio.continueToPrice')}
                onPress={() => router.push('/(app)/studio/price')}
                icon={<ArrowRight size={18} color="#FFFFFF" />}
                style={{ flex: 1.4 }}
              />
            </HStack>
          </VStack>
        )}
      </ScrollView>
    </Box>
    </SafeAreaView>
  );
}

function StepDot({
  label,
  state,
  colors,
}: {
  label: string;
  state: 'done' | 'active' | 'pending';
  colors: ThemeColors;
}) {
  const bg =
    state === 'done' || state === 'active' ? colors.primary : colors.border;
  const textColor = state === 'active' ? colors.primary : colors.textMuted;

  return (
    <HStack alignItems="center" space="xs">
      <Box
        width={26}
        height={26}
        borderRadius={13}
        alignItems="center"
        justifyContent="center"
        style={{ backgroundColor: bg }}
      >
        {state === 'done' ? (
          <Check size={14} color="#FFFFFF" />
        ) : (
          <Text style={{ fontSize: 11, fontWeight: FontWeight.bold, color: state === 'active' ? '#FFFFFF' : colors.textMuted }}>
            •
          </Text>
        )}
      </Box>
      <Text style={{ fontSize: 11, fontWeight: state === 'active' ? FontWeight.bold : FontWeight.regular, color: textColor }}>
        {label}
      </Text>
    </HStack>
  );
}

function StepLine({ colors }: { colors: ThemeColors }) {
  return <Box width={14} height={2} style={{ backgroundColor: colors.border }} />;
}
