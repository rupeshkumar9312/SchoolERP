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

/** Writes a base64 payload (e.g. a failures workbook returned inline in a
 * JSON response, not from its own endpoint) to the cache dir and shares it —
 * same hand-off as openAttachment(), just skipping the network download. */
export async function shareBase64File(base64: string, fileName: string): Promise<void> {
  const destination = new File(new Directory(Paths.cache), fileName);
  if (destination.exists) destination.delete();
  destination.create();
  destination.write(base64, { encoding: 'base64' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(destination.uri);
}

/** Web builds a CSV and triggers a browser file download; native has no
 * download folder in the same sense, so this writes to the cache dir and
 * hands off to the share sheet instead — the user picks where it lands. */
export async function shareTextFile(content: string, fileName: string): Promise<void> {
  const destination = new File(new Directory(Paths.cache), fileName);
  if (destination.exists) destination.delete();
  destination.create();
  destination.write(content, { encoding: 'utf8' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(destination.uri);
}
