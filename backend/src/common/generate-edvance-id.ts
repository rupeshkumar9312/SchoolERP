import { Prisma } from '@prisma/client';

export type EdvanceIdPrefix = 'ADM' | 'TCH' | 'STU';

/** Digit width per prefix — admin-tier accounts are rare (a school has a
 * handful of staff), teachers/students are numerous, so they get more room. */
const ID_WIDTH: Record<EdvanceIdPrefix, number> = {
  ADM: 3,
  TCH: 6,
  STU: 6,
};

/** Atomically reserves the next Edvance ID for `prefix`, e.g. 'EDV-TCH-000123'
 * or 'EDV-ADM-001'. Must be called inside the same `$transaction` that
 * creates the User row consuming it — the upsert's UPDATE branch takes a row
 * lock on `id_sequences`, so two concurrent creates for the same prefix can
 * never be handed the same number. */
export async function nextEdvanceId(
  tx: Prisma.TransactionClient,
  prefix: EdvanceIdPrefix,
): Promise<string> {
  const seq = await tx.idSequence.upsert({
    where: { prefix },
    create: { prefix, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `EDV-${prefix}-${String(seq.lastValue).padStart(ID_WIDTH[prefix], '0')}`;
}

/** Short login alias derived from an edvanceId: 'EDV-TCH-000123' -> 'tch000123'.
 * Not stored — computed from `edvanceId` both for display (so an admin has
 * something short to hand a teacher/student) and for login resolution (see
 * resolveEdvanceIdFromAlias), which reverses this exact transform. */
export function edvanceLoginAlias(edvanceId: string): string {
  return edvanceId.replace(/^EDV-/, '').replace(/-/g, '').toLowerCase();
}

/** Reverses edvanceLoginAlias: 'tch000123' -> 'EDV-TCH-000123'. Returns null
 * for anything that isn't letters-then-digits (i.e. not alias-shaped at all —
 * including a real email address, which AuthService tries first anyway). */
export function resolveEdvanceIdFromAlias(input: string): string | null {
  const match = /^([a-z]+)(\d+)$/i.exec(input.trim());
  if (!match) return null;
  return `EDV-${match[1].toUpperCase()}-${match[2]}`;
}
