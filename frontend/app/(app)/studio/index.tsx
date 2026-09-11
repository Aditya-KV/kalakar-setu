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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { X, Camera, ImageIcon, RotateCcw, Check, Lightbulb, Plus } from 'lucide-react-native';
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
import { useExitToHomeOnBack } from '../../../lib/exit-to-home';

interface GalleryVariant {
  key: string;
  label: string;
  url: string;
}

import { mediaUrl } from '../../../lib/product-text';

const HOST_URL = apiClient.defaults.baseURL || 'http://localhost:8000/api/v1';
const MAX_PHOTOS = 6;

export default function PhotoStudioScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const { draft, addPhoto, removePhoto } = useCatalogDraft();
  const { user } = useAuth();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showPhotoWarning, setShowPhotoWarning] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const photos = draft.photos;
  const atMaxPhotos = photos.length >= MAX_PHOTOS;

  const [rawImageUri, setRawImageUri] = useState<string | null>(null);
  const [enhancedImageUri, setEnhancedImageUri] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryVariant[]>([]);
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  useExitToHomeOnBack(!isEnhancing);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [lastPickedUri, setLastPickedUri] = useState<string | null>(null);
  const [enhanceQuality, setEnhanceQuality] = useState<boolean>(true);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<'WHITE' | 'WARM_WHITE' | 'SOFT_OFF_WHITE'>('WARM_WHITE');
  const [processingStep, setProcessingStep] = useState(0);

  // Simple animated processing-state sequence — the backend doesn't report
  // real stage-by-stage progress to the client, so this cycles through
  // plausible stage labels rather than faking a percentage.
  useEffect(() => {
    if (!isEnhancing) {
      setProcessingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setProcessingStep((prev) => (prev + 1) % 5);
    }, 1400);
    return () => clearInterval(interval);
  }, [isEnhancing]);

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
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const uri = await preserveDraftMedia(result.assets[0].uri, user!.id, 'photo');
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

  const runEnhance = async (mediaIdToEnhance: string, uri: string, qualityOn: boolean, bg: string, controller: AbortController) => {
    const enhanceRes = await apiClient.post(`/media/enhance/${mediaIdToEnhance}`, {
      remove_background: true, auto_contrast: qualityOn, background: bg,
    }, { timeout: 120000, signal: controller.signal });
    if (controller.signal.aborted) return;
    const updated = enhanceRes.data;
    setEnhancedImageUri(mediaUrl(updated.bg_removed_url || updated.enhanced_url, HOST_URL) || uri);
    setGallery(updated.gallery || []);
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
      setOriginalUrl(media.original_url || uri);
      await runEnhance(media.id, uri, enhanceQuality, background, controller);
    } catch {
      if (controller.signal.aborted) return;
      setEnhancedImageUri(uri);
      setPhotoError(uploaded ? 'studio.enhanceFailed' : 'studio.uploadFailedMessage');
    } finally {
      if (!controller.signal.aborted) setIsEnhancing(false);
    }
  };

  const handleToggleEnhanceQuality = async (value: boolean) => {
    setEnhanceQuality(value);
    if (!mediaId || !lastPickedUri) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsEnhancing(true);
    setPhotoError(null);
    try {
      await runEnhance(mediaId, lastPickedUri, value, background, controller);
    } catch {
      if (controller.signal.aborted) return;
      setPhotoError('studio.enhanceFailed');
    } finally {
      if (!controller.signal.aborted) setIsEnhancing(false);
    }
  };

  const handleSelectBackground = async (value: typeof background) => {
    setBackground(value);
    if (!mediaId || !lastPickedUri) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsEnhancing(true);
    setPhotoError(null);
    try {
      await runEnhance(mediaId, lastPickedUri, enhanceQuality, value, controller);
    } catch {
      if (controller.signal.aborted) return;
      setPhotoError('studio.enhanceFailed');
    } finally {
      if (!controller.signal.aborted) setIsEnhancing(false);
    }
  };

  const resetWorkingSlot = () => {
    setRawImageUri(null);
    setEnhancedImageUri(null);
    setPhotoError(null);
    setQualityScore(null);
    setLastPickedUri(null);
    setOriginalUrl(null);
    setGallery([]);
    setMediaId(null);
  };

  // Commits the photo currently being edited into the draft's photo list and
  // clears the working slot so the capture cards reappear for the next shot.
  const handleAddPhoto = () => {
    if (!mediaId) return;
    addPhoto({ mediaId, photoUri: originalUrl || lastPickedUri, gallery });
    resetWorkingSlot();
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

        {/* Photos already added to this listing */}
        {photos.length > 0 && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.addedPhotosSection}>
            <Text style={styles.addedPhotosTitle}>{t('studio.addedPhotosTitle')}</Text>
            <Text style={styles.addedPhotosSubtitle}>{t('studio.addedPhotosSubtitle', { max: MAX_PHOTOS })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.addedPhotosScroll}>
              {photos.map((photo, index) => (
                <Animated.View key={`${photo.mediaId}-${index}`} entering={FadeInDown.delay(index * 60).duration(260)} style={styles.addedPhotoCard}>
                  <Image
                    source={{ uri: mediaUrl(photo.gallery[0]?.url || photo.photoUri, HOST_URL)! }}
                    style={styles.addedPhotoImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    accessibilityLabel={t('studio.removePhotoLabel')}
                    style={styles.addedPhotoRemove}
                    onPress={() => removePhoto(index)}
                    hitSlop={8}
                  >
                    <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.addedPhotoPrimaryBadge}>
                      <Text style={styles.addedPhotoPrimaryText}>{t('studio.coverPhoto')}</Text>
                    </View>
                  )}
                </Animated.View>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Capture / Select Photo Buttons */}
        {!rawImageUri && !atMaxPhotos && (
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

        {!rawImageUri && atMaxPhotos && (
          <Animated.View entering={FadeInDown.duration(280)} style={styles.maxPhotosBanner}>
            <Text style={styles.maxPhotosText}>{t('studio.maxPhotosReached', { max: MAX_PHOTOS })}</Text>
          </Animated.View>
        )}

        {/* Photo Guidelines — shown before a photo is picked, so the tips are
            actionable at the moment the artisan is about to shoot. */}
        {!rawImageUri && (
          <Animated.View entering={FadeInDown.delay(150).duration(320)} style={styles.tipsCard}>
            <View style={styles.tipsHeaderRow}>
              <Lightbulb size={16} color={colors.primary} strokeWidth={2} />
              <Text style={styles.tipsTitle}>{t('studio.photoTipsTitle')}</Text>
            </View>
            {(['photoTip1', 'photoTip2', 'photoTip3', 'photoTip4', 'photoTip5'] as const).map((key) => (
              <View key={key} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <Text style={styles.tipText}>{t(`studio.${key}`)}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Quality Analysis Warning Banner */}
        {qualityScore !== null && <QualityAlert score={qualityScore} issues={qualityIssues} />}
        <RequestFeedback error={photoError ? t(photoError) : null} onRetry={!mediaId && lastPickedUri ? () => uploadAndAnalyze(lastPickedUri) : undefined} />

        {rawImageUri && (
          <View style={styles.enhanceToggleRow}>
            <View style={styles.enhanceToggleText}>
              <Text style={styles.enhanceToggleLabel}>{t('studio.enhanceQualityOption')}</Text>
              <Text style={styles.enhanceToggleSub}>{t('studio.enhanceQualityOptionSub')}</Text>
            </View>
            <Switch
              value={enhanceQuality}
              onValueChange={handleToggleEnhanceQuality}
              disabled={isEnhancing}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        )}

        {/* Studio Background Selector */}
        {rawImageUri && (
          <View style={styles.backgroundRow}>
            <Text style={styles.backgroundLabel}>{t('studio.backgroundLabel')}</Text>
            <View style={styles.backgroundOptions}>
              {(['WHITE', 'WARM_WHITE', 'SOFT_OFF_WHITE'] as const).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.backgroundChip, background === option && styles.backgroundChipActive]}
                  onPress={() => handleSelectBackground(option)}
                  disabled={isEnhancing}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.backgroundSwatch,
                      { backgroundColor: option === 'WHITE' ? '#FFFFFF' : option === 'WARM_WHITE' ? '#FAF9F6' : '#F7F5F0' },
                    ]}
                  />
                  <Text style={[styles.backgroundChipText, background === option && styles.backgroundChipTextActive]}>
                    {t(`studio.background${option === 'WHITE' ? 'White' : option === 'WARM_WHITE' ? 'WarmWhite' : 'OffWhite'}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Interactive Before/After Split Slider Comparison */}
        {isEnhancing ? (
          <Animated.View entering={FadeIn.duration(250)} style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {t(`studio.processingStep${processingStep + 1}`)}
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

        {/* Add this shot to the listing and capture another, without leaving the Photo step */}
        {mediaId && !isEnhancing && !atMaxPhotos && (
          <Animated.View entering={FadeInDown.duration(240)}>
            <TouchableOpacity style={styles.addAnotherButton} onPress={handleAddPhoto} activeOpacity={0.8}>
              <Plus size={16} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.addAnotherText}>{t('studio.addAnotherPhoto')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Bottom Action Controls */}
        <View style={styles.actionRow}>
          {rawImageUri && (
            <TouchableOpacity
              disabled={isEnhancing}
              style={styles.retakeButton}
              onPress={resetWorkingSlot}
              activeOpacity={0.8}
            >
              <RotateCcw size={16} color={colors.textPrimary} />
              <Text style={styles.retakeText}>{t('studio.retake')}</Text>
            </TouchableOpacity>
          )}

          <Button
            title={mediaId ? t('studio.looksGood') : t('common.continue')}
            disabled={isEnhancing}
            onPress={() => {
              if (mediaId) {
                handleAddPhoto();
                router.push('/(app)/studio/voice');
                return;
              }
              if (photos.length > 0) {
                router.push('/(app)/studio/voice');
                return;
              }
              setShowPhotoWarning(true);
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
  addedPhotosSection: {
    marginBottom: Spacing.md,
  },
  addedPhotosTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  addedPhotosSubtitle: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  addedPhotosScroll: {
    flexGrow: 0,
  },
  addedPhotoCard: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addedPhotoImage: {
    width: '100%',
    height: '100%',
  },
  addedPhotoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addedPhotoPrimaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
  },
  addedPhotoPrimaryText: {
    fontSize: 9,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  maxPhotosBanner: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  maxPhotosText: {
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  addAnotherText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.primary,
  },
  tipsCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  tipsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  tipsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: colors.textPrimary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  tipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  backgroundRow: {
    marginBottom: Spacing.md,
  },
  backgroundLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  backgroundOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  backgroundChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backgroundChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  backgroundSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backgroundChipText: {
    fontSize: 11,
    fontWeight: FontWeight.semibold,
    color: colors.textSecondary,
  },
  backgroundChipTextActive: {
    color: colors.primary,
  },
  enhanceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  enhanceToggleText: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  enhanceToggleLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: colors.textPrimary,
  },
  enhanceToggleSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
