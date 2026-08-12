import { Navigate, useNavigate } from 'react-router-dom';
import edvanceLogoDark from '../assets/edvance-logo-dark.png';
import edvanceLogo from '../assets/edvance-logo.png';
import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useAuth } from '../auth/useAuth';

/** Standalone route (outside AppShell, like LoginPage) — reached only while
 * mustChangePassword is true (ProtectedRoute forces every other route here).
 * A voluntary later change lives in Settings, reusing the same form. */
export function ChangePasswordPage() {
  const { state, logout } = useAuth();
  const navigate = useNavigate();

  if (state.status === 'authenticated' && !state.user.mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="shell">
      <header className="login-header">
        <img
          src={edvanceLogoDark}
          alt="EDVANCE — Effortless Management"
          className="login-logo theme-dark-only"
        />
        <img src={edvanceLogo} alt="EDVANCE — Effortless Management" className="login-logo theme-light-only" />
        <p className="subtitle">Set a new password</p>
      </header>

      <p className="muted">
        You're using a temporary password. Set one of your own before continuing.
      </p>

      <ChangePasswordForm onSuccess={() => navigate('/', { replace: true })} />

      <button className="secondary" onClick={() => void logout()}>
        Log out instead
      </button>
    </main>
  );
}
