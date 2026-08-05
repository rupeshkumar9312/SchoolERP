import { createContext } from 'react';

export type ToastKind = 'success' | 'error';

export type ToastFn = (message: string, kind?: ToastKind) => void;

export const ToastContext = createContext<ToastFn | null>(null);
