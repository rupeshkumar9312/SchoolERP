import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeaders } from '../api/client';

/** Downloads an authenticated attachment to the cache dir, then opens the
 * system share/"open with" sheet — there's no in-app viewer, so handing off
 * to whatever app the device already has for the file type is the simplest
 * correct behavior. */
export async function openAttachment(path: string, fileName: string): Promise<void> {
  const destination = new File(new Directory(Paths.cache), fileName);
  if (destination.exists) destination.delete();

  const file = await File.downloadFileAsync(`${API_URL}${path}`, destination, {
    headers: authHeaders(),
    idempotent: true,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri);
}
