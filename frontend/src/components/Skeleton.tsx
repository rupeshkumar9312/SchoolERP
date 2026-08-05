interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width = '100%', height = '1em', className = '' }: SkeletonProps) {
  return <span className={`skeleton ${className}`} style={{ width, height }} />;
}

/** Placeholder for a `.data-table` while its rows are loading. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="card">
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, r) => (
          <div className="skeleton-table-row" key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} height="0.95rem" width={c === 0 ? '70%' : `${55 + ((r + c) % 3) * 12}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder for the dashboard's stat-grid + summary cards. */
export function DashboardSkeleton() {
  return (
    <>
      <Skeleton width="14rem" height="1.1rem" className="skeleton-block" />
      <div className="stat-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="stat-card" key={i}>
            <Skeleton width="2.5rem" height="2.5rem" className="skeleton-round" />
            <div style={{ flex: 1 }}>
              <Skeleton width="60%" height="0.75rem" />
              <Skeleton width="40%" height="1.6rem" className="skeleton-block" />
            </div>
          </div>
        ))}
      </div>
      <div className="card skeleton-block">
        <Skeleton width="40%" height="1.1rem" />
        <Skeleton width="30%" height="2rem" className="skeleton-block" />
        <Skeleton width="100%" height="0.5rem" className="skeleton-block" />
      </div>
    </>
  );
}
