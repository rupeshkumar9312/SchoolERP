export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface ResolvedPagination {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

/** Clamps caller-supplied page/limit to sane bounds and derives the
 * Prisma skip/take pair — the one place every paginated `findAll` computes
 * its offset, so the defaults/max only need to change here. */
export function resolvePagination(query: PaginationQuery): ResolvedPagination {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize =
    query.limit && query.limit > 0 ? Math.min(query.limit, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
