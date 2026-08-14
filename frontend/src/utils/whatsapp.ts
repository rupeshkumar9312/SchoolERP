/** Plain "click to chat" WhatsApp link (`wa.me`) — no phone number embedded,
 * since we can't reliably guess a country code from a locally-entered
 * number. Opens WhatsApp with the message pre-filled and lets the admin pick
 * the recipient themselves, same as a normal manual share. */
export interface CredentialsMessageParams {
  name: string;
  loginId: string;
  password: string;
}

/** 'EDV-TCH-000123' -> 'tch000123' — mirrors backend/src/common/generate-edvance-id.ts's
 * edvanceLoginAlias() so the web UI can show the same short form without a
 * round trip; only used for display, never sent anywhere. */
export function edvanceLoginAlias(edvanceId: string): string {
  return edvanceId.replace(/^EDV-/, '').replace(/-/g, '').toLowerCase();
}

function openWhatsApp(message: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
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

export function shareCredentialsViaWhatsApp(params: CredentialsMessageParams): void {
  openWhatsApp(buildCredentialsMessage(params));
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

export function sharePasswordResetViaWhatsApp(params: CredentialsMessageParams): void {
  openWhatsApp(buildPasswordResetMessage(params));
}
