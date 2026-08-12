import { randomBytes } from 'crypto';

/** Readable, guessable-enough-to-type-by-hand temp password — shared by every
 * flow that provisions or resets a login on someone else's behalf (student
 * admission, a SUPER_ADMIN resetting another user's password). The caller
 * copies it once from the API response and hands it to the account owner. */
export function generateTempPassword(): string {
  return randomBytes(6).toString('base64url');
}
