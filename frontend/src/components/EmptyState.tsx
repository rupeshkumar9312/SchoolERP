import type { ReactNode } from 'react';

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 13.5 6.5 5h11L20 13.5" />
      <path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5" />
      <path d="M4 13.5h5.2c.3 1.2 1.4 2 2.8 2s2.5-.8 2.8-2H20" />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon ?? <DefaultIcon />}</div>
      <p className="empty-state-title">{title}</p>
      {message && <p className="muted">{message}</p>}
      {action}
    </div>
  );
}
