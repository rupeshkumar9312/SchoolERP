import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import edvanceLogoDark from '../assets/edvance-logo-dark.png';
import edvanceLogo from '../assets/edvance-logo.png';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { PasswordField } from '../components/PasswordField';

export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  if (state.status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from;
    return <Navigate to={from?.pathname ?? '/'} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="shell">
      <header className="login-header">
        <img
          src={edvanceLogoDark}
          alt="EDVANCE — Effortless Management"
          className="login-logo theme-dark-only"
        />
        <img src={edvanceLogo} alt="EDVANCE — Effortless Management" className="login-logo theme-light-only" />
        <p className="subtitle">Sign in</p>
      </header>

      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Email or login ID</span>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        {error && (
          <div className="status down">
            <strong>Sign in failed</strong>
            <p>{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => setShowForgotPassword(true)}
        >
          Forgot password?
        </button>
      </form>

      {showForgotPassword && (
        <div className="modal-backdrop" onClick={() => setShowForgotPassword(false)}>
          <div className="modal-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Forgot your password?</h3>
            <p className="muted">
              Please contact your school administrator to have your password reset.
            </p>
            <div className="modal-actions">
              <button onClick={() => setShowForgotPassword(false)} autoFocus>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
