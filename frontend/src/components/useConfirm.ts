import { useContext } from 'react';
import { ConfirmContext, type ConfirmFn } from './confirmDialogContext';

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return ctx;
}
