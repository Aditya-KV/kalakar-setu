import type { ProductText } from '../../lib/product-text';

export interface DraftGalleryVariant { key: string; label: string; url: string }
export interface DraftPhoto { mediaId: string | null; photoUri: string | null; gallery: DraftGalleryVariant[] }
export interface DraftListing {
  photos: DraftPhoto[];
  title: ProductText | null;
  description: ProductText | null;
  // Best-guess craft category inferred from the voice description (not
  // limited to a fixed list). Falls back to the seller's own registered
  // craft at publish time only when this is still null.
  craftType: string | null;
  attributes: { material: string[]; color: string[]; technique: string[] } | null;
  keywords: string[];
  price: string;
  quantity: string;
  transcript: string;
  recordingUri: string | null;
  sourceLanguage: 'en' | 'hi' | 'mr';
}

export const emptyDraft = (): DraftListing => ({
  photos: [], title: null, description: null, craftType: null,
  attributes: null, keywords: [], price: '', quantity: '1', transcript: '',
  recordingUri: null, sourceLanguage: 'hi',
});

export function hasDraftContent(draft: DraftListing) {
  return !!(draft.photos.length || draft.title || draft.transcript || draft.recordingUri || draft.price);
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
      if (!saved.draft) throw new Error('Unsupported draft');

      if (saved.version === 2 && Array.isArray(saved.draft.photos)) {
        return { ...emptyDraft(), ...saved.draft };
      }

      // Migrate a pre-multi-photo (version 1) draft, which carried a single
      // mediaId/photoUri/gallery at the top level, into the new photos array
      // so an in-progress draft from before this change isn't discarded.
      if (saved.version === 1 && Array.isArray(saved.draft.gallery)) {
        const legacy = saved.draft;
        const photos: DraftPhoto[] = legacy.mediaId || legacy.photoUri
          ? [{ mediaId: legacy.mediaId ?? null, photoUri: legacy.photoUri ?? null, gallery: legacy.gallery ?? [] }]
          : [];
        return { ...emptyDraft(), ...legacy, photos };
      }

      throw new Error('Unsupported draft');
    },
    save(userId: string, draft: DraftListing): Promise<unknown> {
      const value = JSON.stringify({ version: 2, draft });
      // Serialize writes so a slow earlier save cannot overwrite newer work.
      const next = (pending.get(userId) || Promise.resolve()).catch(() => undefined)
        .then(() => storage.setItem(key(userId), value));
      pending.set(userId, next);
      return next;
    },
  };
}
