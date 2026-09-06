export interface ProductText { en: string; hi: string; mr?: string | null }

// Older products may not have Marathi. Never present Hindi as Marathi.
export function productText(text: ProductText, language: string): string {
  const locale = language.split('-')[0];
  return (locale === 'mr' ? text.mr : locale === 'hi' ? text.hi : text.en)?.trim()
    || text.en?.trim() || text.hi?.trim() || '';
}

export function mediaUrl(path: string | null | undefined, apiUrl: string): string | null {
  if (!path) return null;
  if (/^(https?:|file:|blob:|data:)/i.test(path)) return path;
  return `${apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
