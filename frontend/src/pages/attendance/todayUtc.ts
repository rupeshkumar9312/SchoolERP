/** The backend's same-day check for teachers compares calendar dates in UTC
 * (matching how a bare "YYYY-MM-DD" is parsed and how `@db.Date` stores it).
 * Defaulting the date picker to the browser's *local* date would disagree
 * with the server whenever the two differ — e.g. IST is UTC+5:30, so for the
 * first ~5.5 hours of an IST calendar day the two dates are a day apart. */
export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
