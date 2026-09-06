// A blob URL expires on reload; store its data so a saved draft can reopen it.
export async function preserveDraftMedia(uri: string, _userId: string, _kind: 'photo' | 'recording'): Promise<string> {
  if (!uri.startsWith('blob:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
