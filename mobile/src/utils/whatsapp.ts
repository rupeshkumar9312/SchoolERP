import { Linking } from 'react-native';

/** No phone number embedded — we can't reliably guess a country code from a
 * locally-entered number, so this opens WhatsApp's own contact picker with
 * the message pre-filled, same as a normal manual share. */
export interface CredentialsMessageParams {
  name: string;
  loginId: string;
  password: string;
}

/** 'EDV-TCH-000123' -> 'tch000123' — mirrors backend/src/common/generate-edvance-id.ts's
 * edvanceLoginAlias() so the app can show the same short form without a
 * round trip; only used for display, never sent anywhere. */
export function edvanceLoginAlias(edvanceId: string): string {
  return edvanceId.replace(/^EDV-/, '').replace(/-/g, '').toLowerCase();
}

/** Tries the WhatsApp app's own URL scheme first (opens straight into the
 * app's contact picker); falls back to the web wa.me link, which redirects
 * into the app if it's installed or opens WhatsApp Web/download otherwise. */
async function openWhatsApp(message: string): Promise<void> {
  const text = encodeURIComponent(message);
  try {
    await Linking.openURL(`whatsapp://send?text=${text}`);
  } catch {
    await Linking.openURL(`https://wa.me/?text=${text}`);
  }
}

export function buildCredentialsMessage({ name, loginId, password }: CredentialsMessageParams): string {
  return [
    `Welcome to EDVANCE, ${name}!`,
    '',
    'Your login has been created. Use the details below to sign in:',
    '',
    `Login ID: ${loginId}`,
    `Password: ${password}`,
    '',
    'Please log in and change your password immediately. Keep these credentials confidential — do not share them with anyone else.',
  ].join('\n');
}

export async function shareCredentialsViaWhatsApp(params: CredentialsMessageParams): Promise<void> {
  await openWhatsApp(buildCredentialsMessage(params));
}

export function buildPasswordResetMessage({ name, loginId, password }: CredentialsMessageParams): string {
  return [
    `Hi ${name}, this is EDVANCE.`,
    '',
    'Your password has been reset. Use the details below to sign in:',
    '',
    `Login ID: ${loginId}`,
    `New password: ${password}`,
    '',
    'Please log in and change your password immediately. Keep these credentials confidential — do not share them with anyone else.',
  ].join('\n');
}

export async function sharePasswordResetViaWhatsApp(params: CredentialsMessageParams): Promise<void> {
  await openWhatsApp(buildPasswordResetMessage(params));
}
