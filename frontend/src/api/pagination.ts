export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageParams {
  page?: number;
  limit?: number;
}

/** The backend clamps `limit` to this (see backend/src/common/pagination.ts)
 * — the highest a single page can ever return. Callers that need "everyone
 * in this one class+section" (marking attendance, a class roster) rather
 * than a browsable page pass this explicitly, since a real class section
 * stays well under it. */
export const MAX_ROSTER_PAGE_SIZE = 100;

/** Appends page/limit onto an existing URLSearchParams — shared by every
 * paginated list endpoint's api function. */
export function appendPageParams(params: URLSearchParams, page?: PageParams): void {
  if (page?.page) params.set('page', String(page.page));
  if (page?.limit) params.set('limit', String(page.limit));
}
