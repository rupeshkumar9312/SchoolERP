interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Shared pager for the paginated list endpoints (students, teachers, exams,
 * announcements, assignments) — shows "1–25 of 249" plus prev/next, since
 * these lists are browsed sequentially rather than jumped to a specific
 * page number. */
export function Pager({ page, pageSize, total, onPageChange }: PagerProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <span className="pager-summary">
        {from}–{to} of {total}
      </span>
      <div className="pager-controls">
        <button
          type="button"
          className="secondary"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="pager-page">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="secondary"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
