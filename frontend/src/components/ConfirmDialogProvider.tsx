import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmContext, type ConfirmFn, type ConfirmOptions } from './confirmDialogContext';

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    setOptions(null);
    resolver.current?.(value);
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [options, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="modal-backdrop" onClick={() => settle(false)}>
          <div className="modal-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{options.title}</h3>
            {options.message && <p className="muted">{options.message}</p>}
            <div className="modal-actions">
              <button className="secondary" onClick={() => settle(false)} autoFocus>
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button className={options.danger === false ? undefined : 'danger'} onClick={() => settle(true)}>
                {options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
