import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { X, Camera, ImageIcon, RotateCcw, Check } from 'lucide-react-native';
import { useAuth } from '../../../features/auth/hooks';
import { preserveDraftMedia } from '../../../lib/draft-media';
import { mediaForm } from '../../../lib/media-form';
import { RequestFeedback } from '../../../components/ui/RequestFeedback';
import { useTheme } from '../../../features/theme/context';
import { useCatalogDraft } from '../../../features/catalog/context';
import { ThemeColors } from '../../../constants/Colors';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { BeforeAfterSlider } from '../../../components/ui/BeforeAfterSlider';
import { QualityAlert } from '../../../components/ui/QualityAlert';
import { apiClient } from '../../../lib/api-client';

interface GalleryVariant {
  key: string;
  label: string;
  url: string;
}

import { mediaUrl } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';

export default function PhotoStudioScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { draft, setPhotoStep } = useCatalogDraft();
  const { user } = useAuth();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPhotoWarning, setShowPhotoWarning] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const [rawImageUri, setRawImageUri] = useState<string | null>(mediaUrl(draft.photoUri, HOST_URL));
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(mediaUrl(draft.gallery[0]?.url, HOST_URL));
  const [gallery, setGallery] = useState<GalleryVariant[]>(draft.gallery);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [mediaId, setMediaId] = useState<string | null>(draft.mediaId);
  const [lastPickedUri, setLastPickedUri] = useState<string | null>(draft.photoUri);

  // Pick photo from gallery or camera
  const handlePickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t('studio.permissionTitle'), t('studio.cameraPermission'));
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: true,
          aspect: [4, 4],
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: true,
          aspect: [4, 4],
        });
      }

      if (!result.canceled && result.assets[0]) {
        const uri = await preserveDraftMedia(result.assets[0].uri, user!.id, 'photo');
        setPhotoStep(null, [], uri);
        setPhotoError(null);
        setQualityScore(null);
        setRawImageUri(uri);
        setEnhancedImageUri(null);
        setGallery([]);
        setMediaId(null);
        uploadAndAnalyze(uri);
      }
    } catch (e) {
      setPhotoError('studio.photoFailed');
    }
  };

  const uploadAndAnalyze = async (uri: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLastPickedUri(uri);
    setIsEnhancing(true);
    setPhotoError(null);
    let uploaded = false;
    try {
      const formData = await mediaForm(uri, 'photo.jpg', 'image/jpeg');
      const uploadRes = await apiClient.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const media = uploadRes.data;
      uploaded = true;
      setMediaId(media.id);
      setQualityScore(media.quality_score);
      setQualityIssues(media.quality_issues || []);
      // Keep the successful upload even if enhancement fails.
      setPhotoStep(media.id, [], media.original_url || uri);
      const enhanceRes = await apiClient.post(`/media/enhance/${media.id}`, {
        remove_background: true, auto_contrast: true,
      }, { timeout: 120000, signal: controller.signal });
      if (controller.signal.aborted) return;
      const updated = enhanceRes.data;
      setEnhancedImageUri(mediaUrl(updated.bg_removed_url || updated.enhanced_url, HOST_URL) || uri);
      setGallery(updated.gallery || []);
      setPhotoStep(media.id, updated.gallery || [], media.original_url || uri);
    } catch {
      if (controller.signal.aborted) return;
      setEnhancedImageUri(uri);
      setPhotoError(uploaded ? 'studio.enhanceFailed' : 'studio.uploadFailedMessage');
    } finally {
      if (!controller.signal.aborted) setIsEnhancing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity accessibilityLabel={t('common.back')} disabled={isEnhancing} onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('studio.photoTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Stepped Workflow Indicator matching Screen 2 of Mockup */}
        <View style={styles.stepperRow}>
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumActive}>1</Text>
          </View>
          <Text style={styles.stepTextActive}>{t('studio.stepPhoto')}</Text>

          <View style={styles.stepLine} />

          <View style={styles.stepCircle}>
            <Text style={styles.stepNum}>2</Text>
          </View>
          <Text style={styles.stepText}>{t('studio.stepVoice')}</Text>

          <View style={styles.stepLine} />

          <View style={styles.stepCircle}>
            <Text style={styles.stepNum}>3</Text>
          </View>
          <Text style={styles.stepText}>{t('studio.stepPrice')}</Text>

          <View style={styles.stepLine} />

          <View style={styles.stepCircle}>
            <Text style={styles.stepNum}>4</Text>
          </View>
          <Text style={styles.stepText}>{t('studio.stepPublish')}</Text>
        </View>

        <Animated.Text entering={FadeInDown.duration(300)} style={styles.sectionTitle}>
          {t('studio.enhanceTitle')}
        </Animated.Text>

        {/* Capture / Select Photo Buttons */}
        {!rawImageUri && (
          <Animated.View entering={FadeInDown.delay(100).duration(320)} style={styles.captureCardGroup}>
            <TouchableOpacity
              style={styles.captureCard}
              onPress={() => handlePickImage('camera')}
              activeOpacity={0.8}
            >
              <Camera size={30} color={colors.primary} style={styles.captureIcon} />
              <Text style={styles.captureTitle}>{t('studio.takePhoto')}</Text>
              <Text style={styles.captureSub}>{t('studio.takePhotoSub')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureCard}
              onPress={() => handlePickImage('library')}
              activeOpacity={0.8}
            >
              <ImageIcon size={30} color={colors.primary} style={styles.captureIcon} />
              <Text style={styles.captureTitle}>{t('studio.uploadGallery')}</Text>
              <Text style={styles.captureSub}>{t('studio.uploadGallerySub')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Quality Analysis Warning Banner */}
        {qualityScore !== null && <QualityAlert score={qualityScore} issues={qualityIssues} />}
        <RequestFeedback error={photoError ? t(photoError) : null} onRetry={!mediaId && lastPickedUri ? () => uploadAndAnalyze(lastPickedUri) : undefined} />

        {/* Interactive Before/After Split Slider Comparison */}
        {isEnhancing ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {t('studio.aiProcessing')}
            </Text>
          </Animated.View>
        ) : rawImageUri ? (
          <BeforeAfterSlider
            originalImage={rawImageUri}
            enhancedImage={enhancedImageUri || rawImageUri}
            height={360}
          />
        ) : null}

        {/* Multi-Shot Product Gallery */}
        {gallery.length > 0 && !isEnhancing && (
          <Animated.View entering={FadeInDown.duration(320)} style={styles.gallerySection}>
            <Text style={styles.galleryTitle}>{t('studio.galleryTitle')}</Text>
            <Text style={styles.gallerySubtitle}>
              {t('studio.gallerySubtitle')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
              {gallery.map((variant, idx) => (
                <Animated.View
                  key={variant.key}
                  entering={FadeInDown.delay(idx * 80).duration(280)}
                  style={styles.galleryCard}
                >
                  <Image
                    source={{ uri: mediaUrl(variant.url, HOST_URL)! }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                  <View style={styles.galleryLabelRow}>
                    <Check size={12} color={colors.success} />
                    <Text style={styles.galleryLabel}>{variant.label}</Text>
                  </View>
                </Animated.View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Bottom Action Controls */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            disabled={isEnhancing}
            style={styles.retakeButton}
            onPress={() => {
              setRawImageUri(null);
              setEnhancedImageUri(null);
              setPhotoError(null);
              setQualityScore(null);
              setLastPickedUri(null);
              setPhotoStep(null, [], null);
              setGallery([]);
              setMediaId(null);
            }}
            activeOpacity={0.8}
          >
            <RotateCcw size={16} color={colors.textPrimary} />
            <Text style={styles.retakeText}>{t('studio.retake')}</Text>
          </TouchableOpacity>

          <Button
            title={t('studio.looksGood')}
            disabled={isEnhancing}
            onPress={() => {
              if (!mediaId) { setShowPhotoWarning(true); return; }
              router.push('/(app)/studio/voice');
            }}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
      <Modal visible={showPhotoWarning} transparent animationType="fade" onRequestClose={() => setShowPhotoWarning(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: Spacing.lg }}>
          <View accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md }}>
            <Text style={styles.headerTitle}>{t('studio.noPhotoUploadedTitle')}</Text>
            <Text style={{ color: colors.textSecondary }}>{t('studio.noPhotoUploadedMessage')}</Text>
            <Button title={t('common.cancel')} variant="outline" onPress={() => setShowPhotoWarning(false)} />
            {lastPickedUri && <Button title={t('studio.retryUpload')} onPress={() => { setShowPhotoWarning(false); void uploadAndAnalyze(lastPickedUri); }} />}
            <Button title={t('studio.continueAnyway')} variant="outline" onPress={() => {
              setShowPhotoWarning(false);
              setPhotoStep(null, [], null);
              router.push('/(app)/studio/voice');
            }} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: colors.textMuted,
  },
  stepNumActive: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  stepText: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
    marginRight: 6,
  },
  stepTextActive: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: colors.primary,
    marginLeft: 4,
    marginRight: 6,
  },
  stepLine: {
    width: 16,
    height: 2,
    backgroundColor: colors.border,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  captureCardGroup: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.md,
  },
  captureCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    ...Shadows.card,
  },
  captureIcon: {
    marginBottom: 6,
  },
  captureTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  captureSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    marginVertical: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  gallerySection: {
    marginTop: Spacing.lg,
  },
  galleryTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  gallerySubtitle: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  galleryScroll: {
    flexGrow: 0,
  },
  galleryCard: {
    width: 130,
    marginRight: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  galleryImage: {
    width: '100%',
    height: 130,
    backgroundColor: colors.surfaceElevated,
  },
  galleryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  galleryLabel: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.lg,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  retakeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
});
