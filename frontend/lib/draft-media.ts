import { File, Paths } from 'expo-file-system';

// Copy temporary camera/recorder output into the app's durable documents folder.
export async function preserveDraftMedia(uri: string, userId: string, kind: 'photo' | 'recording'): Promise<string> {
  if (!uri.startsWith('file:')) return uri;
  const suffix = uri.split('.').pop()?.split('?')[0] || (kind === 'photo' ? 'jpg' : 'm4a');
  const target = new File(Paths.document, `draft-${encodeURIComponent(userId)}-${kind}.${suffix}`);
  if (target.uri === uri) return uri;
  if (target.exists) target.delete();
  new File(uri).copy(target);
  return target.uri;
}
