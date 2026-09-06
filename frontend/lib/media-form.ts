import { Platform } from 'react-native';

export async function mediaForm(uri: string, name: string, type: string): Promise<FormData> {
  const data = new FormData();
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('Could not read selected media');
    data.append('file', await response.blob(), name);
  } else {
    data.append('file', { uri, name, type } as any);
  }
  return data;
}
