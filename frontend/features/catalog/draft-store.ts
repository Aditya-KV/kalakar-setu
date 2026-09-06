import type { ProductText } from '../../lib/product-text';

export interface DraftGalleryVariant { key: string; label: string; url: string }
export interface DraftListing {
  mediaId: string | null;
  photoUri: string | null;
  gallery: DraftGalleryVariant[];
  title: ProductText | null;
  description: ProductText | null;
  attributes: { material: string[]; color: string[]; technique: string[] } | null;
  keywords: string[];
  price: string;
  quantity: string;
  transcript: string;
  recordingUri: string | null;
  sourceLanguage: 'en' | 'hi' | 'mr';
}

export const emptyDraft = (): DraftListing => ({
  mediaId: null, photoUri: null, gallery: [], title: null, description: null,
  attributes: null, keywords: [], price: '', quantity: '1', transcript: '',
  recordingUri: null, sourceLanguage: 'hi',
});

export function hasDraftContent(draft: DraftListing) {
  return !!(draft.mediaId || draft.photoUri || draft.title || draft.transcript || draft.recordingUri || draft.price);
}

interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

export function createDraftStore(storage: StorageAdapter) {
  const pending = new Map<string, Promise<unknown>>();
  const key = (userId: string) => `kalakar_product_draft_v1:${userId}`;
  return {
    async load(userId: string): Promise<DraftListing> {
      await pending.get(userId)?.catch(() => undefined);
      const raw = await storage.getItem(key(userId));
      if (!raw) return emptyDraft();
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !saved.draft || !Array.isArray(saved.draft.gallery)) {
        throw new Error('Unsupported draft');
      }
      return { ...emptyDraft(), ...saved.draft };
    },
    save(userId: string, draft: DraftListing): Promise<unknown> {
      const value = JSON.stringify({ version: 1, draft });
      // Serialize writes so a slow earlier save cannot overwrite newer work.
      const next = (pending.get(userId) || Promise.resolve()).catch(() => undefined)
        .then(() => storage.setItem(key(userId), value));
      pending.set(userId, next);
      return next;
    },
  };
}
