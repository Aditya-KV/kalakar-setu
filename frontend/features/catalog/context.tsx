import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/hooks';
import { RequestFeedback } from '../../components/ui/RequestFeedback';
import { createDraftStore, DraftListing, DraftGalleryVariant, emptyDraft, hasDraftContent } from './draft-store';

export type { DraftListing, DraftGalleryVariant } from './draft-store';
const draftStore = createDraftStore(AsyncStorage);

interface CatalogDraftContextType {
  draft: DraftListing;
  hasDraft: boolean;
  ready: boolean;
  loadError: boolean;
  retryRestore: () => void;
  updateDraft: (patch: Partial<DraftListing>) => void;
  setPhotoStep: (mediaId: string | null, gallery: DraftGalleryVariant[], photoUri?: string | null) => void;
  setVoiceStep: (data: Pick<DraftListing, 'title' | 'description' | 'attributes' | 'keywords'>) => void;
  resetDraft: () => Promise<void>;
}

const CatalogDraftContext = createContext<CatalogDraftContextType | undefined>(undefined);

function AccountDraftProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(emptyDraft);
  const current = useRef(draft);
  const [ready, setReady] = useState(!userId);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const revision = useRef(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoadError(false);
    draftStore.load(userId).then((saved) => {
      if (!active) return;
      current.current = saved;
      setDraft(saved);
      setReady(true);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [userId, attempt]);

  const persist = async (next: DraftListing) => {
    const version = ++revision.current;
    if (!userId) return;
    try {
      await draftStore.save(userId, next);
      if (version === revision.current) setSaveError(false);
    } catch (error) {
      if (version === revision.current) setSaveError(true);
      throw error;
    }
  };

  const updateDraft = (patch: Partial<DraftListing>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    setDraft(next);
    void persist(next).catch(() => undefined);
  };

  const resetDraft = async () => {
    const next = emptyDraft();
    await persist(next);
    current.current = next;
    setDraft(next);
  };

  return <CatalogDraftContext.Provider value={{ draft, hasDraft: hasDraftContent(draft), ready, loadError,
    retryRestore: () => setAttempt((value) => value + 1), updateDraft,
    setPhotoStep: (mediaId, gallery, photoUri) => updateDraft({ mediaId, gallery, ...(photoUri !== undefined ? { photoUri } : {}) }),
    setVoiceStep: updateDraft, resetDraft }}>
    {saveError && <RequestFeedback error={t('studio.saveDraftFailed')} onRetry={() => { void persist(current.current).catch(() => undefined); }} />}
    {children}
  </CatalogDraftContext.Provider>;
}

export function CatalogDraftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <AccountDraftProvider key={user?.id || 'signed-out'} userId={user?.id || null}>{children}</AccountDraftProvider>;
}

export function useCatalogDraft() {
  const context = useContext(CatalogDraftContext);
  if (!context) throw new Error('useCatalogDraft must be used within a CatalogDraftProvider');
  return context;
}
