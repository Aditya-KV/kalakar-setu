import { File, Directory, Paths } from 'expo-file-system';

// Copy temporary camera/recorder output into the app's durable documents folder.
export async function preserveDraftMedia(uri: string, userId: string, kind: 'photo' | 'recording'): Promise<string> {
  if (!uri.startsWith('file:')) return uri;
  const suffix = uri.split('.').pop()?.split('?')[0] || (kind === 'photo' ? 'jpg' : 'm4a');
  const prefix = `draft-${encodeURIComponent(userId)}-${kind}-`;

  // Filename must be unique per capture, not a fixed per-user path — React
  // Native's <Image>/audio caches key purely on the URI string, so reusing
  // the same path for every retake would keep showing the previous photo's
  // cached bitmap even after the underlying file content changed on disk.
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const target = new File(Paths.document, `${prefix}${unique}.${suffix}`);
  if (target.uri === uri) return uri;

  new File(uri).copy(target);

  // Best-effort cleanup of this user/kind's earlier draft file(s) so unique
  // filenames don't accumulate forever across retakes.
  try {
    const docs = new Directory(Paths.document);
    for (const entry of docs.list()) {
      if (entry instanceof File && entry.name.startsWith(prefix) && entry.uri !== target.uri) {
        entry.delete();
      }
    }
  } catch {
    // Non-fatal — stale draft files are a minor disk-space nit, not worth failing the capture over.
  }

  return target.uri;
}
