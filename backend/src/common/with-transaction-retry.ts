import { Prisma } from '@prisma/client';

/** P2028 ("Transaction API error: Transaction not found") is a connection
 * lifecycle failure, not a data problem — it means the DB connection an
 * interactive transaction was using got dropped/reset before the
 * transaction could finish. On a serverless host talking to a remote DB
 * with no connection pooler in front of it, this is a transient, retryable
 * condition: the transaction never committed (the DB rolls back anything
 * uncommitted when a connection drops), so a retry starts clean. */
const RETRYABLE_CODES = new Set(['P2028']);

function isRetryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_CODES.has(error.code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs `fn` (expected to itself call `prisma.$transaction(...)`), retrying
 * up to `attempts` times, only for the specific error codes above — any
 * other error (validation, unique-constraint conflict, etc.) is rethrown
 * immediately on the first try. */
export async function withTransactionRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 300,
): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isRetryable(error) || attempt === attempts) throw error;
      await sleep(delayMs);
    }
  }
  // Unreachable — the loop above always returns or throws.
  throw new Error('withTransactionRetry: exhausted attempts without a result');
}
