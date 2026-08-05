import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { API_URL } from './api/client';
import { fetchHealth, type HealthResponse } from './api/health';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; health: HealthResponse }
  | { phase: 'error'; message: string };

function App() {
  const [state, setState] = useState<State>({ phase: 'loading' });

  const check = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'ready', health: await fetchHealth() });
    } catch (error) {
      setState({ phase: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <main className="shell">
      <header>
        <h1>School ERP</h1>
        <p className="subtitle">Module 0 — Project Setup</p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>API health</h2>
          <button onClick={() => void check()} disabled={state.phase === 'loading'}>
            {state.phase === 'loading' ? 'Checking…' : 'Re-check'}
          </button>
        </div>

        <p className="endpoint">
          GET <code>{API_URL}/health</code>
        </p>

        {state.phase === 'loading' && <p className="muted">Contacting the API…</p>}

        {state.phase === 'error' && (
          <div className="status down">
            <strong>Unreachable</strong>
            <p>{state.message}</p>
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            <div className={`status ${state.health.status === 'ok' ? 'up' : 'down'}`}>
              <strong>API: {state.health.status}</strong>
              <p>
                {state.health.service} · up {state.health.uptime}s
              </p>
            </div>
            <div
              className={`status ${state.health.dependencies.database.status === 'up' ? 'up' : 'down'}`}
            >
              <strong>Database: {state.health.dependencies.database.status}</strong>
              {state.health.dependencies.database.error && (
                <p>{state.health.dependencies.database.error}</p>
              )}
            </div>
            <pre>{JSON.stringify(state.health, null, 2)}</pre>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
