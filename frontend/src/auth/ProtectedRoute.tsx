import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

export function ProtectedRoute({ permission }: { permission?: string }) {
  const { state, hasPermission } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return <p className="muted">Loading…</p>;
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <p className="muted">You don't have permission to view this page.</p>;
  }

  return <Outlet />;
}
